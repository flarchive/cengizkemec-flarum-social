<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\Message;
use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\RoomBan;
use CengizKemec\Social\Models\RoomCategory;
use CengizKemec\Social\Models\RoomInvitation;
use CengizKemec\Social\Models\RoomModerator;
use CengizKemec\Social\Models\RoomParticipant;
use CengizKemec\Social\Models\TextChannel;
use CengizKemec\Social\Realtime\Centrifugo;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\ModerationLogService;
use CengizKemec\Social\Support\RoomSlug;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Voice\LiveKit;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class AdminRoomController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected MediaManager $media,
        protected Centrifugo $realtime,
        protected ModerationLogService $logs,
        protected LiveKit $livekit
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertAdmin();

        return match ($this->routeName($request)) {
            'social.admin.rooms.index' => $this->index($request),
            'social.admin.rooms.create' => $this->createRoom($request),
            'social.admin.rooms.reorder' => $this->reorderRooms($request),
            'social.admin.rooms.update' => $this->updateRoom($request),
            'social.admin.rooms.delete' => $this->deleteRoom($request),
            'social.admin.categories.create' => $this->createCategory($request),
            'social.admin.categories.reorder' => $this->reorderCategories($request),
            'social.admin.categories.update' => $this->updateCategory($request),
            'social.admin.categories.delete' => $this->deleteCategory($request),
            'social.admin.channels.create' => $this->createChannel($request),
            'social.admin.channels.update' => $this->updateChannel($request),
            'social.admin.channels.delete' => $this->deleteChannel($request),
            default => $this->notFound(),
        };
    }

    protected function index(ServerRequestInterface $request): ResponseInterface
    {
        $categories = RoomCategory::query()->orderBy('sort_order')->get();
        $rooms = Room::query()->with(['owner', 'category'])->orderBy('sort_order')->orderBy('name')->get();
        $channels = TextChannel::query()->orderBy('position')->get();

        return $this->json([
            'data' => [
                'categories' => $categories->map(fn (RoomCategory $category) => [
                    'id' => (int) $category->id,
                    'name' => $category->name,
                    'icon' => $category->icon,
                    'description' => $category->description,
                    'sortOrder' => (int) $category->sort_order,
                ])->all(),
                'rooms' => $rooms->map(fn (Room $room) => [
                    'id' => (int) $room->id,
                    'slug' => $room->slug ?: 'room-'.$room->id,
                    'name' => $room->name,
                    'description' => $room->description,
                    'icon' => $room->icon,
                    'type' => $room->type,
                    'visibility' => $room->visibility,
                    'categoryId' => $room->category_id ? (int) $room->category_id : null,
                    'categoryName' => $room->category?->name,
                    'ownerId' => $room->owner_id ? (int) $room->owner_id : null,
                    'ownerName' => $room->owner?->display_name,
                    'capacity' => (int) $room->capacity,
                    'participantCount' => (int) $room->participant_count,
                    'isVoice' => (bool) $room->is_voice,
                    'isText' => (bool) $room->is_text,
                    'isLocked' => (bool) $room->is_locked,
                    'allowScreenShare' => (bool) $room->allow_screen_share,
                    'hasPassword' => $room->password_hash !== null,
                    'allowedGroups' => $room->allowed_groups ?? [],
                    'sortOrder' => (int) $room->sort_order,
                    'status' => $room->status,
                    'expiresAt' => $room->expires_at?->toIso8601String(),
                    'createdAt' => $room->created_at?->toIso8601String(),
                    'channels' => $channels->where('room_id', $room->id)->map(fn (TextChannel $channel) => [
                        'id' => (int) $channel->id,
                        'name' => $channel->name,
                        'description' => $channel->description,
                        'visibility' => $channel->visibility,
                        'position' => (int) $channel->position,
                        'isLocked' => (bool) $channel->is_locked,
                    ])->values()->all(),
                ])->all(),
                'channels' => $channels->whereNull('room_id')->map(fn (TextChannel $channel) => [
                    'id' => (int) $channel->id,
                    'name' => $channel->name,
                    'description' => $channel->description,
                    'visibility' => $channel->visibility,
                    'position' => (int) $channel->position,
                    'isLocked' => (bool) $channel->is_locked,
                    'categoryId' => $channel->category_id ? (int) $channel->category_id : null,
                    'categoryName' => $channel->category?->name,
                ])->values()->all(),
                'livekitConfigured' => $this->livekit->configured(),
                'limits' => [
                    'defaultRoomCapacity' => max(2, $this->settings->int('default_room_capacity')),
                    'maxRoomCapacity' => max(2, $this->settings->int('max_room_capacity')),
                    'maxScreenShares' => max(1, $this->settings->int('max_screen_shares')),
                    'voiceEnabled' => $this->settings->bool('enable_voice'),
                    'voiceConfigured' => $this->livekit->configured(),
                ],
            ],
        ]);
    }

    protected function createRoom(ServerRequestInterface $request): ResponseInterface
    {
        $body = $this->body($request);
        $name = $this->cleanString($body['name'] ?? '', 100);

        if (mb_strlen($name) < 2) {
            $this->validationError('room_name_invalid');
        }

        $isVoice = (bool) ($body['is_voice'] ?? true);
        $isText = (bool) ($body['is_text'] ?? true);

        if (! $isVoice && ! $isText) {
            $this->validationError('room_needs_feature');
        }

        $categoryId = (int) ($body['category_id'] ?? 0) ?: null;

        if ($categoryId && ! RoomCategory::query()->find($categoryId)) {
            $this->validationError('category_not_found');
        }

        $room = new Room();
        $room->category_id = $categoryId;
        $room->owner_id = null;
        $room->type = 'permanent';
        $room->name = $name;
        $room->slug = ! empty($body['slug'])
            ? RoomSlug::unique((string) $body['slug'])
            : RoomSlug::unique($name);
        $room->description = $this->cleanString($body['description'] ?? '', 2000) ?: null;
        $room->icon = $this->cleanString($body['icon'] ?? 'fas fa-headset', 60);
        $requestedVisibility = $body['visibility'] ?? 'public';
        $room->visibility = in_array($requestedVisibility, ['public', 'members', 'private', 'staff'], true) ? $requestedVisibility : 'public';
        $room->capacity = max(2, min($this->settings->int('max_room_capacity'), (int) ($body['capacity'] ?? $this->settings->int('default_room_capacity'))));
        $room->is_voice = $isVoice;
        $room->is_text = $isText;
        $room->allow_screen_share = (bool) ($body['allow_screen_share'] ?? true);
        $room->force_muted = true;
        $room->allowed_groups = $this->intArray($body['allowed_groups'] ?? []) ?: null;
        $room->sort_order = (int) ($body['sort_order'] ?? 0);
        $room->status = 'active';
        $room->password_hash = ! empty($body['password']) ? password_hash((string) $body['password'], PASSWORD_DEFAULT) : null;
        $room->last_activity_at = \Illuminate\Support\now();
        $room->created_at = \Illuminate\Support\now();
        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        if ($isText) {
            $this->createDefaultChannel($room);
        }

        $this->logs->log($this->actor($request), 'admin.room.created', 'room', $room->id);
        $this->audit('social.room.created', ['room_id' => (int) $room->id, 'admin' => true, 'visibility' => $room->visibility, 'voice' => (bool) $room->is_voice, 'text' => (bool) $room->is_text]);
        $this->realtime->publish('social:rooms', ['type' => 'room.created', 'room_id' => $room->id]);

        return $this->json(['data' => ['id' => (int) $room->id]], 201);
    }

    protected function updateRoom(ServerRequestInterface $request): ResponseInterface
    {
        $room = Room::query()->find((int) $this->routeParam($request, 'id'));

        if (! $room) {
            return $this->notFound('room_not_found');
        }

        $body = $this->body($request);

        if (isset($body['name'])) {
            $name = $this->cleanString($body['name'], 100);
            if (mb_strlen($name) < 2) {
                $this->validationError('room_name_invalid');
            }
            $room->name = $name;
        }

        if (array_key_exists('description', $body)) {
            $room->description = $this->cleanString($body['description'], 2000) ?: null;
        }

        if (isset($body['slug']) && (string) $body['slug'] !== '') {
            $room->slug = RoomSlug::unique((string) $body['slug'], (int) $room->id);
        }

        if (array_key_exists('icon', $body)) {
            $room->icon = $this->cleanString($body['icon'], 60);
        }

        if (array_key_exists('category_id', $body)) {
            $categoryId = (int) $body['category_id'] ?: null;
            if ($categoryId && ! RoomCategory::query()->find($categoryId)) {
                $this->validationError('category_not_found');
            }
            $room->category_id = $categoryId;
        }

        if (isset($body['visibility']) && in_array($body['visibility'], ['public', 'members', 'private', 'staff'], true)) {
            $room->visibility = $body['visibility'];
        }

        if (isset($body['capacity'])) {
            $room->capacity = max(2, min($this->settings->int('max_room_capacity'), (int) $body['capacity']));
        }

        foreach (['is_voice', 'is_text', 'allow_screen_share', 'is_locked'] as $flag) {
            if (array_key_exists($flag, $body)) {
                $room->{$flag} = (bool) $body[$flag];
            }
        }

        if (array_key_exists('allowed_groups', $body)) {
            $room->allowed_groups = $this->intArray($body['allowed_groups']) ?: null;
        }

        if (array_key_exists('sort_order', $body)) {
            $room->sort_order = (int) $body['sort_order'];
        }

        if (array_key_exists('password', $body)) {
            $room->password_hash = $body['password'] ? password_hash((string) $body['password'], PASSWORD_DEFAULT) : null;
        }

        if (array_key_exists('status', $body) && in_array($body['status'], ['active', 'closed'], true)) {
            $room->status = $body['status'];
        }

        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        $this->logs->log($this->actor($request), 'admin.room.updated', 'room', $room->id);
        $this->audit('social.room.updated', ['room_id' => (int) $room->id, 'admin' => true]);
        $this->realtime->publish('social:rooms', ['type' => 'room.updated', 'room_id' => $room->id]);

        return $this->json(['data' => ['id' => (int) $room->id]]);
    }

    protected function deleteRoom(ServerRequestInterface $request): ResponseInterface
    {
        $room = Room::query()->find((int) $this->routeParam($request, 'id'));

        if (! $room) {
            return $this->notFound('room_not_found');
        }

        $this->destroyRoom($room);
        $this->logs->log($this->actor($request), 'admin.room.deleted', 'room', $room->id);
        $this->audit('social.room.deleted', ['room_id' => (int) $room->id, 'admin' => true]);

        return $this->json(['data' => ['deleted' => true]]);
    }

    protected function reorderRooms(ServerRequestInterface $request): ResponseInterface
    {
        $ids = $this->intArray($this->body($request)['ids'] ?? []);

        if (! $ids) {
            $this->validationError('rooms_required');
        }

        $rooms = Room::query()->whereIn('id', $ids)->get()->keyBy('id');
        $position = 0;

        foreach ($ids as $id) {
            $room = $rooms->get($id);

            if (! $room) {
                continue;
            }

            $room->sort_order = $position;
            $room->updated_at = \Illuminate\Support\now();
            $room->save();
            $position += 10;
        }

        $this->realtime->publish('social:rooms', ['type' => 'rooms.reordered']);
        $this->logs->log($this->actor($request), 'admin.rooms.reordered', 'room', 0);
        $this->audit('social.rooms.reordered', ['ids' => $ids]);

        return $this->json(['data' => ['reordered' => true]]);
    }

    protected function reorderCategories(ServerRequestInterface $request): ResponseInterface
    {
        $ids = $this->intArray($this->body($request)['ids'] ?? []);

        if (! $ids) {
            $this->validationError('categories_required');
        }

        $categories = RoomCategory::query()->whereIn('id', $ids)->get()->keyBy('id');
        $position = 0;

        foreach ($ids as $id) {
            $category = $categories->get($id);

            if (! $category) {
                continue;
            }

            $category->sort_order = $position;
            $category->updated_at = \Illuminate\Support\now();
            $category->save();
            $position += 10;
        }

        $this->realtime->publish('social:rooms', ['type' => 'rooms.reordered']);
        $this->logs->log($this->actor($request), 'admin.categories.reordered', 'category', 0);
        $this->audit('social.categories.reordered', ['ids' => $ids]);

        return $this->json(['data' => ['reordered' => true]]);
    }

    protected function createCategory(ServerRequestInterface $request): ResponseInterface
    {
        $body = $this->body($request);
        $name = $this->cleanString($body['name'] ?? '', 100);

        if ($name === '') {
            $this->validationError('category_name_invalid');
        }

        $category = new RoomCategory();
        $category->name = $name;
        $category->icon = $this->cleanString($body['icon'] ?? 'fas fa-folder', 60);
        $category->description = $this->cleanString($body['description'] ?? '', 500) ?: null;
        $category->sort_order = array_key_exists('sort_order', $body)
            ? (int) $body['sort_order']
            : ((int) RoomCategory::query()->max('sort_order')) + 10;
        $category->created_at = \Illuminate\Support\now();
        $category->updated_at = \Illuminate\Support\now();
        $category->save();

        return $this->json(['data' => ['id' => (int) $category->id]], 201);
    }

    protected function updateCategory(ServerRequestInterface $request): ResponseInterface
    {
        $category = RoomCategory::query()->find((int) $this->routeParam($request, 'id'));

        if (! $category) {
            return $this->notFound('category_not_found');
        }

        $body = $this->body($request);

        if (isset($body['name'])) {
            $name = $this->cleanString($body['name'], 100);
            if ($name === '') {
                $this->validationError('category_name_invalid');
            }
            $category->name = $name;
        }

        if (array_key_exists('icon', $body)) {
            $category->icon = $this->cleanString($body['icon'], 60);
        }

        if (array_key_exists('description', $body)) {
            $category->description = $this->cleanString($body['description'], 500) ?: null;
        }

        if (array_key_exists('sort_order', $body)) {
            $category->sort_order = (int) $body['sort_order'];
        }

        $category->updated_at = \Illuminate\Support\now();
        $category->save();

        return $this->json(['data' => ['id' => (int) $category->id]]);
    }

    protected function deleteCategory(ServerRequestInterface $request): ResponseInterface
    {
        $category = RoomCategory::query()->find((int) $this->routeParam($request, 'id'));

        if (! $category) {
            return $this->notFound('category_not_found');
        }

        Room::query()->where('category_id', $category->id)->update(['category_id' => null]);
        $category->delete();

        return $this->json(['data' => ['deleted' => true]]);
    }

    protected function createChannel(ServerRequestInterface $request): ResponseInterface
    {
        $body = $this->body($request);
        $name = $this->cleanString($body['name'] ?? '', 100);
        $roomId = (int) ($body['room_id'] ?? 0) ?: null;
        $categoryId = (int) ($body['category_id'] ?? 0) ?: null;

        if ($name === '' || ! preg_match('/^[a-z0-9][a-z0-9-]{1,99}$/', $name)) {
            $this->validationError('channel_name_invalid');
        }

        if ($roomId && ! Room::query()->find($roomId)) {
            $this->validationError('room_not_found');
        }

        if ($categoryId && ! RoomCategory::query()->find($categoryId)) {
            $this->validationError('category_not_found');
        }

        if (TextChannel::query()->where('room_id', $roomId)->where('name', $name)->exists()) {
            $this->validationError('channel_exists');
        }

        $channel = new TextChannel();
        $channel->room_id = $roomId;
        $channel->category_id = $categoryId;
        $channel->name = $name;
        $channel->description = $this->cleanString($body['description'] ?? '', 500) ?: null;
        $requestedVisibility = $body['visibility'] ?? 'members';
        $channel->visibility = in_array($requestedVisibility, ['public', 'members', 'staff'], true) ? $requestedVisibility : 'members';
        $channel->position = (int) ($body['position'] ?? 0);
        $channel->is_default = false;
        $channel->is_locked = (bool) ($body['is_locked'] ?? false);
        $channel->created_at = \Illuminate\Support\now();
        $channel->updated_at = \Illuminate\Support\now();
        $channel->save();

        return $this->json(['data' => ['id' => (int) $channel->id]], 201);
    }

    protected function updateChannel(ServerRequestInterface $request): ResponseInterface
    {
        $channel = TextChannel::query()->find((int) $this->routeParam($request, 'id'));

        if (! $channel) {
            return $this->notFound('channel_not_found');
        }

        $body = $this->body($request);

        if (isset($body['name'])) {
            $name = $this->cleanString($body['name'], 100);
            if (! preg_match('/^[a-z0-9][a-z0-9-]{1,99}$/', $name)) {
                $this->validationError('channel_name_invalid');
            }
            $channel->name = $name;
        }

        if (array_key_exists('description', $body)) {
            $channel->description = $this->cleanString($body['description'], 500) ?: null;
        }

        if (array_key_exists('category_id', $body)) {
            $categoryId = (int) $body['category_id'] ?: null;

            if ($categoryId && ! RoomCategory::query()->find($categoryId)) {
                $this->validationError('category_not_found');
            }

            $channel->category_id = $categoryId;
        }

        if (isset($body['visibility']) && in_array($body['visibility'], ['public', 'members', 'staff'], true)) {
            $channel->visibility = $body['visibility'];
        }

        if (array_key_exists('position', $body)) {
            $channel->position = (int) $body['position'];
        }

        if (array_key_exists('is_locked', $body)) {
            $channel->is_locked = (bool) $body['is_locked'];
        }

        $channel->updated_at = \Illuminate\Support\now();
        $channel->save();

        return $this->json(['data' => ['id' => (int) $channel->id]]);
    }

    protected function deleteChannel(ServerRequestInterface $request): ResponseInterface
    {
        $channel = TextChannel::query()->find((int) $this->routeParam($request, 'id'));

        if (! $channel) {
            return $this->notFound('channel_not_found');
        }

        foreach (Message::query()->where('channel_id', $channel->id)->pluck('id') as $messageId) {
            $this->media->detach('channel_message', $messageId);
        }

        Message::query()->where('channel_id', $channel->id)->delete();
        $channel->delete();

        return $this->json(['data' => ['deleted' => true]]);
    }

    protected function createDefaultChannel(Room $room): TextChannel
    {
        $channel = new TextChannel();
        $channel->room_id = $room->id;
        $channel->name = 'general';
        $channel->description = $room->name.' text chat';
        $channel->visibility = $room->visibility === 'public' ? 'public' : 'members';
        $channel->position = 0;
        $channel->is_default = true;
        $channel->created_at = \Illuminate\Support\now();
        $channel->updated_at = \Illuminate\Support\now();
        $channel->save();

        return $channel;
    }

    protected function destroyRoom(Room $room): void
    {
        foreach (TextChannel::query()->where('room_id', $room->id)->get() as $channel) {
            foreach (Message::query()->where('channel_id', $channel->id)->pluck('id') as $messageId) {
                $this->media->detach('channel_message', $messageId);
            }
            Message::query()->where('channel_id', $channel->id)->delete();
            $channel->delete();
        }

        RoomParticipant::query()->where('room_id', $room->id)->delete();
        RoomModerator::query()->where('room_id', $room->id)->delete();
        RoomInvitation::query()->where('room_id', $room->id)->delete();
        \CengizKemec\Social\Models\RoomInviteLink::query()->where('room_id', $room->id)->delete();
        RoomBan::query()->where('room_id', $room->id)->delete();

        if ($this->livekit->configured()) {
            $this->livekit->deleteRoom($this->livekit->roomName($room));
        }

        $room->delete();
        $this->realtime->publish('social:rooms', ['type' => 'room.deleted', 'room_id' => $room->id]);
    }
}
