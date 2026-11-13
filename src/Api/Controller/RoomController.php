<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Message;
use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\RoomBan;
use CengizKemec\Social\Models\RoomCategory;
use CengizKemec\Social\Models\RoomInvitation;
use CengizKemec\Social\Models\RoomInviteLink;
use CengizKemec\Social\Models\RoomModerator;
use CengizKemec\Social\Models\RoomParticipant;
use CengizKemec\Social\Models\TextChannel;
use CengizKemec\Social\Realtime\Centrifugo;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\ModerationLogService;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\RateLimit;
use CengizKemec\Social\Support\RoomPresenter;
use CengizKemec\Social\Support\RoomSlug;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\VoiceActivityTracker;
use CengizKemec\Social\Voice\LiveKit;
use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Cleanup\CleanupService;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class RoomController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected RoomPresenter $presenter,
        protected LiveKit $livekit,
        protected Centrifugo $realtime,
        protected Notifier $notifier,
        protected ModerationLogService $logs,
        protected RateLimit $rateLimit,
        protected MediaManager $media,
        protected CleanupService $cleanup,
        protected VoiceActivityTracker $voiceActivity
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        return match ($this->routeName($request)) {
            'social.rooms.index' => $this->index($request),
            'social.rooms.show' => $this->show($request),
            'social.rooms.create' => $this->create($request),
            'social.rooms.update' => $this->update($request),
            'social.rooms.delete' => $this->delete($request),
            'social.rooms.action' => $this->action($request),
            'social.invites.show' => $this->showInvite($request),
            'social.presence.janitor' => $this->janitor(),
            default => $this->notFound(),
        };
    }

    protected function index(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);

        if (! $this->access->canViewCommunity($actor)) {
            return $this->forbidden('community_forbidden');
        }

        $rooms = Room::query()
            ->with('owner')
            ->where('status', 'active')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->filter(fn (Room $room) => $this->access->canViewRoom($room, $actor))
            ->values();

        $categories = RoomCategory::query()
            ->orderBy('sort_order')
            ->get()
            ->map(fn (RoomCategory $category) => [
                'id' => (int) $category->id,
                'name' => $category->name,
                'icon' => $category->icon,
                'description' => $category->description,
            ])
            ->all();

        $channels = TextChannel::query()
            ->whereNull('room_id')
            ->with('category')
            ->orderBy('position')
            ->get()
            ->filter(fn (TextChannel $channel) => $this->access->canViewChannel($channel, $actor))
            ->map(fn (TextChannel $channel) => [
                'id' => (int) $channel->id,
                'name' => $channel->name,
                'description' => $channel->description,
                'visibility' => $channel->visibility,
                'categoryId' => $channel->category_id ? (int) $channel->category_id : null,
                'categoryName' => $channel->category?->name,
            ])
            ->values()
            ->all();

        return $this->json([
            'data' => [
                'categories' => $categories,
                'rooms' => $rooms->map(fn (Room $room) => $this->presenter->present($room, $actor))->all(),
                'channels' => $channels,
                'canCreateRoom' => $this->access->canCreateRoom($actor),
                'livekitConfigured' => $this->livekit->configured(),
            ],
        ]);
    }

    protected function show(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $key = (string) $this->routeParam($request, 'id');
        $query = Room::query()->with(['owner', 'category']);
        $room = ctype_digit($key) ? $query->find((int) $key) : $query->where('slug', $key)->first();

        if (! $room || $room->status !== 'active' || $room->isExpired()) {
            return $this->notFound('room_not_found');
        }

        if (! $this->access->canViewRoom($room, $actor)) {
            return $this->forbidden('room_forbidden');
        }

        return $this->json([
            'data' => array_merge($this->presenter->present($room, $actor, true), [
                'category' => $room->category ? [
                    'id' => (int) $room->category->id,
                    'name' => $room->category->name,
                    'icon' => $room->category->icon,
                ] : null,
                'livekitConfigured' => $this->livekit->configured(),
                'isParticipant' => $actor->isGuest() ? false : $room->participants()->where('user_id', $actor->id)->exists(),
            ]),
        ]);
    }

    protected function create(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        if (! $this->access->canCreateRoom($actor)) {
            throw new PermissionDeniedException();
        }

        $body = $this->body($request);
        $name = $this->cleanString($body['name'] ?? '', 100);
        $description = $this->cleanString($body['description'] ?? '', 1000);

        if (mb_strlen($name) < 2) {
            $this->validationError('room_name_invalid');
        }

        $activeRooms = Room::query()
            ->where('owner_id', $actor->id)
            ->where('type', 'temporary')
            ->where('status', 'active')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', \Illuminate\Support\now());
            })
            ->count();

        if ($activeRooms >= max(1, $this->settings->int('user_room_max_per_user'))) {
            $this->validationError('room_limit_reached');
        }

        $this->rateLimit->assertRoomCreation($actor, max(0, $this->settings->int('user_room_cooldown_seconds')));

        $visibility = in_array($body['visibility'] ?? 'public', ['public', 'private', 'invite'], true)
            ? ($body['visibility'] ?? 'public')
            : 'public';

        if ($visibility !== 'public') {
            if (! $this->settings->bool('user_room_allow_private') || ! $actor->can('social.createPrivateRoom')) {
                throw new PermissionDeniedException();
            }
        }

        $capacity = (int) ($body['capacity'] ?? $this->settings->int('user_room_max_capacity'));
        $capacity = max(2, min($this->settings->int('user_room_max_capacity'), $capacity));

        $isVoice = (bool) ($body['is_voice'] ?? true);
        $isText = (bool) ($body['is_text'] ?? true);

        if (! $isVoice && ! $isText) {
            $this->validationError('room_needs_feature');
        }

        $lifetime = (int) ($body['lifetime_hours'] ?? $this->settings->int('user_room_lifetime_hours'));
        $lifetime = max(1, min($this->settings->int('user_room_max_lifetime_hours'), $lifetime));

        $room = new Room();
        $room->category_id = null;
        $room->owner_id = $actor->id;
        $room->type = 'temporary';
        $room->name = $name;
        $room->slug = RoomSlug::unique($name);
        $room->description = $description ?: null;
        $room->icon = $this->cleanString($body['icon'] ?? 'fas fa-headset', 60);
        $room->visibility = $visibility;
        $room->password_hash = ! empty($body['password']) ? password_hash((string) $body['password'], PASSWORD_DEFAULT) : null;
        $room->capacity = $capacity;
        $room->is_voice = $isVoice;
        $room->is_text = $isText;
        $room->allow_screen_share = (bool) ($body['allow_screen_share'] ?? true);
        $room->force_muted = true;
        $room->allowed_groups = null;
        $room->status = 'active';
        $room->expires_at = \Illuminate\Support\now()->addHours($lifetime);
        $room->last_activity_at = \Illuminate\Support\now();
        $room->created_at = \Illuminate\Support\now();
        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        if ($isText) {
            $channel = new TextChannel();
            $channel->room_id = $room->id;
            $channel->name = 'general';
            $channel->description = $name.' text chat';
            $channel->visibility = $visibility === 'public' ? 'public' : 'members';
            $channel->position = 0;
            $channel->is_default = true;
            $channel->created_at = \Illuminate\Support\now();
            $channel->updated_at = \Illuminate\Support\now();
            $channel->save();
        }

        $moderator = new RoomModerator();
        $moderator->room_id = $room->id;
        $moderator->user_id = $actor->id;
        $moderator->created_at = \Illuminate\Support\now();
        $moderator->save();

        $this->realtime->publish('social:rooms', ['type' => 'room.created', 'room_id' => $room->id]);
        $this->logs->log($actor, 'room.created', 'room', $room->id);
        $this->audit('social.room.created', [
            'room_id' => (int) $room->id,
            'type' => $room->type,
            'visibility' => $room->visibility,
            'voice' => (bool) $room->is_voice,
            'text' => (bool) $room->is_text,
        ]);

        return $this->json([
            'data' => $this->presenter->present($room->fresh(['owner']), $actor, true),
        ], 201);
    }

    protected function update(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $room = Room::query()->find((int) $this->routeParam($request, 'id'));

        if (! $room || $room->status !== 'active') {
            return $this->notFound('room_not_found');
        }

        if (! $this->access->canManageRoom($room, $actor)) {
            throw new PermissionDeniedException();
        }

        $body = $this->body($request);

        if (isset($body['name'])) {
            $name = $this->cleanString($body['name'], 100);
            if (mb_strlen($name) < 2) {
                $this->validationError('room_name_invalid');
            }
            $room->name = $name;
        }

        if (isset($body['description'])) {
            $room->description = $this->cleanString($body['description'], 1000) ?: null;
        }

        if (isset($body['icon'])) {
            $room->icon = $this->cleanString($body['icon'], 60);
        }

        if (isset($body['capacity'])) {
            $max = $room->type === 'temporary' ? $this->settings->int('user_room_max_capacity') : $this->settings->int('max_room_capacity');
            $room->capacity = max(2, min($max, (int) $body['capacity']));
        }

        if (isset($body['visibility']) && in_array($body['visibility'], ['public', 'private', 'invite'], true)) {
            if ($body['visibility'] !== 'public' && $room->type === 'temporary' && ! $this->settings->bool('user_room_allow_private')) {
                throw new PermissionDeniedException();
            }
            $room->visibility = $body['visibility'];
        }

        if (array_key_exists('password', $body)) {
            $room->password_hash = $body['password'] ? password_hash((string) $body['password'], PASSWORD_DEFAULT) : null;
        }

        foreach (['is_voice' => 'is_voice', 'is_text' => 'is_text', 'allow_screen_share' => 'allow_screen_share', 'is_locked' => 'is_locked'] as $key => $column) {
            if (array_key_exists($key, $body)) {
                $room->{$column} = (bool) $body[$key];
            }
        }

        if ($room->type === 'temporary' && isset($body['lifetime_hours'])) {
            $max = $this->settings->int('user_room_max_lifetime_hours');
            $hours = max(1, min($max, (int) $body['lifetime_hours']));
            $room->expires_at = \Illuminate\Support\now()->addHours($hours);
        }

        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        $this->realtime->publish('social:room:'.$room->id, ['type' => 'room.updated', 'room_id' => $room->id]);
        $this->logs->log($actor, 'room.updated', 'room', $room->id);
        $this->audit('social.room.updated', ['room_id' => (int) $room->id, 'visibility' => $room->visibility]);

        return $this->json(['data' => $this->presenter->present($room->fresh(['owner']), $actor, true)]);
    }

    protected function delete(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $room = Room::query()->find((int) $this->routeParam($request, 'id'));

        if (! $room) {
            return $this->notFound('room_not_found');
        }

        if (! $this->access->canManageRoom($room, $actor)) {
            throw new PermissionDeniedException();
        }

        $this->destroyRoom($room);
        $this->logs->log($actor, 'room.deleted', 'room', $room->id);
        $this->audit('social.room.deleted', ['room_id' => (int) $room->id]);

        return $this->json(['data' => ['id' => (int) $room->id, 'deleted' => true]]);
    }

    protected function action(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $room = Room::query()->find((int) $this->routeParam($request, 'id'));
        $action = (string) $this->routeParam($request, 'action');

        if (! $room || $room->status !== 'active' || $room->isExpired()) {
            return $this->notFound('room_not_found');
        }

        return match ($action) {
            'join' => $this->join($room, $request, $actor),
            'leave' => $this->leave($room, $request, $actor),
            'heartbeat' => $this->heartbeat($room, $actor),
            'invite' => $this->invite($room, $request, $actor),
            'invite_link' => $this->createInviteLink($room, $request, $actor),
            'revoke_invite_link' => $this->revokeInviteLink($room, $request, $actor),
            'kick' => $this->moderate($room, $request, $actor, 'kick'),
            'ban' => $this->moderate($room, $request, $actor, 'ban'),
            'unban' => $this->moderate($room, $request, $actor, 'unban'),
            'mute' => $this->moderate($room, $request, $actor, 'mute'),
            'unmute' => $this->moderate($room, $request, $actor, 'unmute'),
            'set_moderator' => $this->moderate($room, $request, $actor, 'set_moderator'),
            'close' => $this->toggleRoom($room, $actor, true),
            'reopen' => $this->toggleRoom($room, $actor, false),
            'transfer' => $this->transfer($room, $request, $actor),
            default => $this->notFound('room_action_unknown'),
        };
    }

    protected function janitor(): ResponseInterface
    {
        return $this->json(['data' => ['deleted' => $this->cleanup->purgeEmptyTemporaryRooms()]]);
    }

    protected function join(Room $room, ServerRequestInterface $request, User $actor): ResponseInterface
    {
        if (! $this->access->canJoinRoom($room, $actor)) {
            return $this->forbidden('room_join_forbidden');
        }

        $body = $this->body($request);

        $invited = RoomInvitation::query()
            ->where('room_id', $room->id)
            ->where('invitee_id', $actor->id)
            ->where('status', 'accepted')
            ->exists();

        if ($room->password_hash && ! $invited && ! password_verify((string) ($body['password'] ?? ''), $room->password_hash)) {
            $this->validationError('room_password_invalid');
        }

        $wantsVoice = array_key_exists('voice', $body)
            ? filter_var($body['voice'], FILTER_VALIDATE_BOOLEAN)
            : (bool) $room->is_voice;

        // Validate voice availability before creating participant presence, so
        // a failed join cannot leave a ghost member in the room.
        if ($wantsVoice && $room->is_voice) {
            if (! $this->access->canUseVoice($actor)) {
                return $this->forbidden('voice_forbidden');
            }

            if (! $this->livekit->configured()) {
                return $this->json([
                    'errors' => [[
                        'status' => '503',
                        'code' => 'voice_not_configured',
                        'detail' => $this->translator->trans('cengizkemec-social.api.errors.voice_not_configured'),
                    ]],
                ], 503);
            }
        }

        $liveCount = RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
            ->count();

        if ($room->is_voice && $liveCount >= $room->capacity) {
            $this->validationError('room_full');
        }

        $participant = RoomParticipant::query()->firstOrNew(['room_id' => $room->id, 'user_id' => $actor->id]);
        $participant->role = $room->owner_id === $actor->id ? 'owner' : (RoomModerator::query()->where('room_id', $room->id)->where('user_id', $actor->id)->exists() ? 'moderator' : 'member');
        $participant->muted = true;
        $participant->joined_at = $participant->joined_at ?: \Illuminate\Support\now();
        $participant->last_seen_at = \Illuminate\Support\now();
        $participant->save();

        $room->participant_count = RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
            ->count();
        $room->last_activity_at = \Illuminate\Support\now();
        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        $voice = null;

        if ($wantsVoice && $room->is_voice) {
            $voice = $this->livekit->token(
                $actor,
                $room,
                $room->allow_screen_share && $actor->can('social.shareScreen')
            );
        }

        $this->realtime->publish('social:room:'.$room->id, [
            'type' => 'participant.joined',
            'user' => ['id' => (int) $actor->id, 'displayName' => $actor->display_name],
        ]);

        return $this->json([
            'data' => [
                'room' => $this->presenter->present($room->fresh(['owner']), $actor, true),
                'voice' => $voice,
                'participant' => [
                    'role' => $participant->role,
                    'muted' => true,
                ],
            ],
        ]);
    }

    protected function leave(Room $room, ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $participant = RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('user_id', $actor->id)
            ->first();

        if ($participant) {
            $this->voiceActivity->record($actor, $room, $participant->joined_at, \Illuminate\Support\now());
            $participant->delete();
        }

        $room->participant_count = RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
            ->count();
        $room->last_activity_at = \Illuminate\Support\now();
        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        if ($room->type === 'temporary'
            && $room->owner_id === $actor->id
            && $this->settings->get('user_room_owner_disconnect') === 'close'
        ) {
            $room->is_locked = true;
            $room->save();
            $this->realtime->publish('social:room:'.$room->id, ['type' => 'room.closed', 'room_id' => $room->id]);
        }

        $this->realtime->publish('social:room:'.$room->id, [
            'type' => 'participant.left',
            'user_id' => (int) $actor->id,
        ]);

        return $this->json(['data' => ['left' => true]]);
    }

    protected function heartbeat(Room $room, User $actor): ResponseInterface
    {
        $present = RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('user_id', $actor->id)
            ->exists();

        if (! $present) {
            return $this->forbidden('room_not_joined');
        }

        RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('user_id', $actor->id)
            ->update(['last_seen_at' => \Illuminate\Support\now()]);

        $room->last_activity_at = \Illuminate\Support\now();
        $room->participant_count = RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
            ->count();
        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        return $this->json(['data' => ['ok' => true, 'participantCount' => $room->participant_count]]);
    }

    protected function invite(Room $room, ServerRequestInterface $request, User $actor): ResponseInterface
    {
        if (! $this->settings->bool('user_room_allow_invites') || ! $this->access->canManageRoom($room, $actor)) {
            throw new PermissionDeniedException();
        }

        $targetId = (int) ($this->body($request)['user_id'] ?? 0);
        $target = User::query()->find($targetId);

        if (! $target || $target->isGuest()) {
            $this->validationError('user_not_found');
        }

        $invitation = RoomInvitation::query()->firstOrNew([
            'room_id' => $room->id,
            'invitee_id' => $target->id,
        ]);
        $invitation->inviter_id = $actor->id;
        $invitation->status = 'pending';
        $invitation->created_at = $invitation->created_at ?: \Illuminate\Support\now();
        $invitation->updated_at = \Illuminate\Support\now();
        $invitation->save();

        $this->notifier->notify($target, 'invite', $actor, 'room', $room->id, [
            'room_id' => $room->id,
            'room_name' => $room->name,
        ]);

        $this->audit('social.room.member_invited', ['room_id' => (int) $room->id, 'user_id' => (int) $target->id]);

        return $this->json(['data' => ['invited' => true, 'user_id' => (int) $target->id]]);
    }

    protected function createInviteLink(Room $room, ServerRequestInterface $request, User $actor): ResponseInterface
    {
        if (! $this->settings->bool('user_room_allow_invites') || ! $this->access->canManageRoom($room, $actor)) {
            throw new PermissionDeniedException();
        }

        $body = $this->body($request);
        $expiresIn = max(0, min(24 * 365, (int) ($body['expires_in'] ?? 24)));
        $maxUses = max(0, min(100000, (int) ($body['max_uses'] ?? 0)));

        do {
            $token = bin2hex(random_bytes(16));
        } while (RoomInviteLink::query()->where('token', $token)->exists());

        $link = new RoomInviteLink();
        $link->room_id = $room->id;
        $link->creator_id = $actor->id;
        $link->token = $token;
        $link->expires_at = $expiresIn > 0 ? \Illuminate\Support\now()->addHours($expiresIn) : null;
        $link->max_uses = $maxUses;
        $link->uses = 0;
        $link->created_at = \Illuminate\Support\now();
        $link->updated_at = \Illuminate\Support\now();
        $link->save();

        $this->audit('social.room.invite_link_created', [
            'room_id' => (int) $room->id,
            'link_id' => (int) $link->id,
            'expires_at' => $link->expires_at?->toIso8601String(),
            'max_uses' => (int) $link->max_uses,
        ]);

        return $this->json(['data' => $this->presentInviteLink($link, $room)], 201);
    }

    protected function revokeInviteLink(Room $room, ServerRequestInterface $request, User $actor): ResponseInterface
    {
        if (! $this->access->canManageRoom($room, $actor)) {
            throw new PermissionDeniedException();
        }

        $id = (int) ($this->body($request)['id'] ?? 0);

        if ($id > 0) {
            RoomInviteLink::query()->where('room_id', $room->id)->where('id', $id)->delete();
        } else {
            RoomInviteLink::query()->where('room_id', $room->id)->delete();
        }

        $this->audit('social.room.invite_link_revoked', ['room_id' => (int) $room->id, 'link_id' => $id ?: null]);

        return $this->json(['data' => ['revoked' => true]]);
    }

    protected function showInvite(ServerRequestInterface $request): ResponseInterface
    {
        $token = trim((string) $this->routeParam($request, 'token'));

        if ($token === '') {
            return $this->notFound('invite_invalid');
        }

        $link = RoomInviteLink::query()->with('room')->where('token', $token)->first();

        if (! $link || ! $link->room || $link->room->status !== 'active' || $link->room->isExpired() || $link->isExpired() || $link->isExhausted()) {
            return $this->notFound('invite_invalid');
        }

        $actor = $this->actor($request);
        $room = $link->room;

        if ($actor->isGuest()) {
            return $this->json([
                'data' => [
                    'requiresLogin' => true,
                    'room' => $this->presenter->present($room, $actor),
                ],
            ]);
        }

        if (! $this->access->canJoinRooms($actor)) {
            return $this->forbidden('invite_forbidden');
        }

        $invitation = RoomInvitation::query()
            ->where('room_id', $room->id)
            ->where('invitee_id', $actor->id)
            ->first();

        if (! $invitation) {
            // Count unique members who redeemed the link, not page refreshes.
            $link->uses = (int) $link->uses + 1;
            $link->updated_at = \Illuminate\Support\now();
            $link->save();
        }

        $invitation = $invitation ?: new RoomInvitation();
        $invitation->room_id = $room->id;
        $invitation->invitee_id = $actor->id;
        $invitation->inviter_id = $link->creator_id;
        $invitation->status = 'accepted';
        $invitation->created_at = $invitation->created_at ?: \Illuminate\Support\now();
        $invitation->updated_at = \Illuminate\Support\now();
        $invitation->save();

        $fresh = Room::query()->with(['owner', 'category'])->find($room->id);

        $this->audit('social.room.invite_redeemed', ['room_id' => (int) $room->id, 'link_id' => (int) $link->id]);

        return $this->json([
            'data' => [
                'requiresLogin' => false,
                'room' => $this->presenter->present($fresh ?: $room, $actor, true),
            ],
        ]);
    }

    protected function presentInviteLink(RoomInviteLink $link, Room $room): array
    {
        $slug = $room->slug ?: 'room-'.$room->id;

        return [
            'id' => (int) $link->id,
            'token' => $link->token,
            'url' => '/social/rooms/'.$slug.'?invite='.$link->token,
            'expiresAt' => $link->expires_at?->toIso8601String(),
            'maxUses' => (int) $link->max_uses,
            'uses' => (int) $link->uses,
        ];
    }

    protected function moderate(Room $room, ServerRequestInterface $request, User $actor, string $action): ResponseInterface
    {
        $body = $this->body($request);
        $targetId = (int) ($body['user_id'] ?? 0);
        $target = User::query()->find($targetId);

        if (! $target) {
            $this->validationError('user_not_found');
        }

        if ($target->isAdmin() && ! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        if ($action === 'set_moderator') {
            if (! $this->access->canManageRoom($room, $actor) || $room->owner_id !== $actor->id && ! $actor->isAdmin()) {
                throw new PermissionDeniedException();
            }

            $moderator = RoomModerator::query()->where('room_id', $room->id)->where('user_id', $target->id)->first();

            if ($moderator) {
                $moderator->delete();
                $granted = false;
            } else {
                $moderator = new RoomModerator();
                $moderator->room_id = $room->id;
                $moderator->user_id = $target->id;
                $moderator->created_at = \Illuminate\Support\now();
                $moderator->save();
                $granted = true;
            }

            $this->audit('social.room.moderator_changed', [
                'room_id' => (int) $room->id,
                'user_id' => (int) $target->id,
                'moderator' => (bool) $granted,
            ]);

            return $this->json(['data' => ['moderator' => $granted, 'user_id' => (int) $target->id]]);
        }

        if (! $this->access->canManageRoom($room, $actor)) {
            throw new PermissionDeniedException();
        }

        if ($target->id === $actor->id) {
            $this->validationError('cannot_moderate_self');
        }

        if ($room->owner_id === $target->id && ! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        if ($action === 'unban') {
            RoomBan::query()->where('room_id', $room->id)->where('user_id', $target->id)->delete();
            return $this->json(['data' => ['unbanned' => true, 'user_id' => (int) $target->id]]);
        }

        if ($action === 'ban') {
            $ban = RoomBan::query()->firstOrNew(['room_id' => $room->id, 'user_id' => $target->id]);
            $ban->actor_id = $actor->id;
            $ban->reason = $this->cleanString($body['reason'] ?? '', 500) ?: null;
            $ban->expires_at = \Illuminate\Support\now()->addHours(max(1, (int) ($body['duration_hours'] ?? 24)));
            $ban->created_at = $ban->created_at ?: \Illuminate\Support\now();
            $ban->save();
        }

        if (in_array($action, ['kick', 'ban'], true)) {
            $participant = RoomParticipant::query()
                ->where('room_id', $room->id)
                ->where('user_id', $target->id)
                ->first();

            if ($participant) {
                $this->voiceActivity->record($target, $room, $participant->joined_at, \Illuminate\Support\now());
                $participant->delete();
            }

            if ($this->livekit->configured()) {
                $this->livekit->removeParticipant($this->livekit->roomName($room), $this->livekit->identity($target));
            }
        }

        if ($action === 'mute' || $action === 'unmute') {
            if ($this->livekit->configured()) {
                $this->livekit->muteParticipant($this->livekit->roomName($room), $this->livekit->identity($target), $action === 'mute');
            }
        }

        $this->livekit->sendData($this->livekit->roomName($room), [
            'type' => 'moderation',
            'action' => $action,
            'user_id' => (int) $target->id,
        ]);

        $room->participant_count = RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(5))
            ->count();
        $room->save();

        $this->logs->log($actor, 'room.'.$action, 'room', $room->id, ['user_id' => (int) $target->id]);
        $this->audit('social.room.member_moderated', [
            'room_id' => (int) $room->id,
            'user_id' => (int) $target->id,
            'action' => $action,
        ]);
        $this->notifier->notify($target, 'moderation', $actor, 'room', $room->id, [
            'room_id' => $room->id,
            'action' => $action,
        ]);

        return $this->json(['data' => ['action' => $action, 'user_id' => (int) $target->id]]);
    }

    protected function toggleRoom(Room $room, User $actor, bool $locked): ResponseInterface
    {
        if (! $this->access->canManageRoom($room, $actor)) {
            throw new PermissionDeniedException();
        }

        $room->is_locked = $locked;
        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        $this->realtime->publish('social:room:'.$room->id, [
            'type' => $locked ? 'room.closed' : 'room.reopened',
            'room_id' => $room->id,
        ]);
        $this->logs->log($actor, $locked ? 'room.closed' : 'room.reopened', 'room', $room->id);
        $this->audit($locked ? 'social.room.closed' : 'social.room.reopened', ['room_id' => (int) $room->id]);

        return $this->json(['data' => ['locked' => $locked]]);
    }

    protected function transfer(Room $room, ServerRequestInterface $request, User $actor): ResponseInterface
    {
        if ($room->owner_id !== $actor->id && ! $actor->isAdmin()) {
            throw new PermissionDeniedException();
        }

        $target = User::query()->find((int) ($this->body($request)['user_id'] ?? 0));

        if (! $target || $target->isGuest()) {
            $this->validationError('user_not_found');
        }

        $previous = $room->owner_id;
        $room->owner_id = $target->id;
        $room->updated_at = \Illuminate\Support\now();
        $room->save();

        if ($previous) {
            RoomModerator::query()->firstOrCreate(['room_id' => $room->id, 'user_id' => $previous], ['created_at' => \Illuminate\Support\now()]);
        }

        RoomModerator::query()->firstOrCreate(['room_id' => $room->id, 'user_id' => $target->id], ['created_at' => \Illuminate\Support\now()]);
        RoomParticipant::query()->where('room_id', $room->id)->where('user_id', $target->id)->update(['role' => 'owner']);
        RoomParticipant::query()->where('room_id', $room->id)->where('user_id', $previous)->update(['role' => 'moderator']);

        $this->notifier->notify($target, 'invite', $actor, 'room', $room->id, [
            'room_id' => $room->id,
            'room_name' => $room->name,
            'ownership_transferred' => true,
        ]);
        $this->logs->log($actor, 'room.ownership_transferred', 'room', $room->id, ['from' => $previous, 'to' => $target->id]);
        $this->audit('social.room.transferred', [
            'room_id' => (int) $room->id,
            'from_user_id' => (int) $previous,
            'to_user_id' => (int) $target->id,
        ]);

        return $this->json(['data' => ['ownerId' => (int) $target->id]]);
    }

    protected function destroyRoom(Room $room): void
    {
        $channels = TextChannel::query()->where('room_id', $room->id)->get();

        foreach ($channels as $channel) {
            foreach (Message::query()->where('channel_id', $channel->id)->pluck('id') as $messageId) {
                $this->media->detach('channel_message', $messageId);
            }

            Message::query()->where('channel_id', $channel->id)->delete();
            $channel->delete();
        }

        if ($this->livekit->configured()) {
            $this->livekit->deleteRoom($this->livekit->roomName($room));
        }

        RoomParticipant::query()->where('room_id', $room->id)->delete();
        RoomModerator::query()->where('room_id', $room->id)->delete();
        RoomInvitation::query()->where('room_id', $room->id)->delete();
        RoomBan::query()->where('room_id', $room->id)->delete();
        $room->delete();

        $this->realtime->publish('social:rooms', ['type' => 'room.deleted', 'room_id' => $room->id]);
    }
}
