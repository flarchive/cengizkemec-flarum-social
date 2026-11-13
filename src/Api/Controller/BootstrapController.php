<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\TextChannel;
use CengizKemec\Social\Cleanup\CleanupService;
use CengizKemec\Social\Models\UserStatus;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\UserPresenter;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\RoomParticipant;
use CengizKemec\Social\Models\VoiceActivity;
use Flarum\User\User;
use Illuminate\Support\Collection;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class BootstrapController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        \CengizKemec\Social\Support\SocialSettings $settings,
        \Flarum\Locale\TranslatorInterface $translator,
        protected UserPresenter $users,
        protected Notifier $notifier,
        protected CleanupService $cleanup
    ) {
        parent::__construct($access, $settings, $translator);
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return $this->dispatch($request);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $isGuest = $actor->isGuest();
        $canView = $this->access->canViewCommunity($actor);
        $leaderboardLimit = max(1, min(20, $this->settings->int('leaderboard_limit')));

        // Opportunistic janitor: temporary rooms vanish shortly after their
        // last participant leaves, without requiring a always-on worker.
        $this->cleanup->purgeEmptyTemporaryRooms();

        $categories = [];
        $rooms = [];
        $channels = [];
        $userRoomCategoryIds = [];

        if ($canView) {
            $rawCategoryIds = (string) $this->settings->get('user_room_category_ids');
            $allowedCategoryIds = array_values(array_unique(array_filter(array_map('intval', preg_split('/[,\s]+/', $rawCategoryIds) ?: []))));

            if ($allowedCategoryIds) {
                $userRoomCategoryIds = \CengizKemec\Social\Models\RoomCategory::query()
                    ->whereIn('id', $allowedCategoryIds)
                    ->orderBy('sort_order')
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all();
            }
            $rooms = Room::query()
                ->where('status', 'active')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
                ->filter(fn (Room $room) => $this->access->canViewRoom($room, $actor))
                ->values();

            $categories = \CengizKemec\Social\Models\RoomCategory::query()
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($category) => [
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
                    'roomId' => null,
                    'categoryId' => $channel->category_id ? (int) $channel->category_id : null,
                    'categoryName' => $channel->category?->name,
                ])
                ->values()
                ->all();
        }

        $onlineMembers = [];
        $offlineMembers = [];
        $onlineCount = 0;

        if ($canView) {
            $onlineCount = User::query()
                ->whereNotNull('last_seen_at')
                ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(5))
                ->count();

            if (! $isGuest || $this->settings->bool('guest_public_profiles')) {
                $onlineMembers = User::query()
                    ->whereNotNull('last_seen_at')
                    ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(5))
                    ->orderByDesc('last_seen_at')
                    ->limit(30)
                    ->get()
                    ->map(fn (User $user) => $this->users->basic($user))
                    ->all();

                $offlineMembers = User::query()
                    ->where('is_email_confirmed', true)
                    ->where(function ($query) {
                        $query->whereNull('last_seen_at')
                            ->orWhere('last_seen_at', '<=', \Illuminate\Support\now()->subMinutes(5));
                    })
                    ->orderByDesc('last_seen_at')
                    ->limit(30)
                    ->get()
                    ->map(fn (User $user) => $this->users->basic($user))
                    ->all();
            }
        }

        $postQuery = Post::query()->whereNull('deleted_at');
        $this->access->scopePosts($postQuery, $actor);

        $topPosters = (clone $postQuery)
            ->select('user_id')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('user_id')
            ->orderByDesc('total')
            ->limit($leaderboardLimit)
            ->get()
            ->map(function ($row) {
                $user = User::query()->find($row->user_id);

                return $user ? array_merge($this->users->basic($user), ['postsCount' => (int) $row->total]) : null;
            })
            ->filter()
            ->values()
            ->all();

        $topLiked = (clone $postQuery)
            ->select('user_id')
            ->selectRaw('COALESCE(SUM(reactions_count), 0) as total')
            ->groupBy('user_id')
            ->orderByDesc('total')
            ->limit($leaderboardLimit)
            ->get()
            ->map(function ($row) {
                $user = User::query()->find($row->user_id);

                return $user ? array_merge($this->users->basic($user), ['likesCount' => (int) $row->total]) : null;
            })
            ->filter()
            ->values()
            ->all();

        $topPosts = (clone $postQuery)
            ->where('reactions_count', '>', 0)
            ->orderByDesc('reactions_count')
            ->orderByDesc('created_at')
            ->limit($leaderboardLimit)
            ->get()
            ->map(fn (Post $post) => [
                'id' => (int) $post->id,
                'body' => mb_substr((string) $post->body, 0, 110),
                'reactionsCount' => (int) $post->reactions_count,
                'user' => $post->user ? $this->users->basic($post->user) : null,
            ])
            ->all();

        $hashtags = [];

        foreach ((clone $postQuery)->orderByDesc('created_at')->limit(200)->get() as $post) {
            foreach ($post->hashtags ?? [] as $tag) {
                $hashtags[$tag] = ($hashtags[$tag] ?? 0) + 1;
            }
        }

        arsort($hashtags);
        $trendingHashtags = collect($hashtags)
            ->take(8)
            ->map(fn ($count, $tag) => ['tag' => $tag, 'count' => $count])
            ->values()
            ->all();

        $voiceUsers = [];
        $voiceRooms = [];

        if (! $isGuest || $this->settings->bool('guest_public_profiles')) {
            $voiceUsers = VoiceActivity::query()
                ->select('user_id')
                ->selectRaw('SUM(seconds) as total')
                ->groupBy('user_id')
                ->orderByDesc('total')
                ->limit($leaderboardLimit)
                ->get()
                ->map(function ($row) {
                    $user = User::query()->find($row->user_id);

                    return $user ? array_merge($this->users->basic($user), ['voiceSeconds' => (int) $row->total]) : null;
                })
                ->filter()
                ->values()
                ->all();
        }

        $voiceRooms = VoiceActivity::query()
            ->select('room_id')
            ->selectRaw('SUM(seconds) as total')
            ->groupBy('room_id')
            ->orderByDesc('total')
            ->limit(max(20, $leaderboardLimit * 2))
            ->get()
            ->map(function ($row) use ($actor) {
                $room = Room::query()->find($row->room_id);

                if (! $room || ! $this->access->canViewRoom($room, $actor)) {
                    return null;
                }

                return [
                    'id' => (int) $room->id,
                    'slug' => $room->slug ?: 'room-'.$room->id,
                    'name' => $room->name,
                    'voiceSeconds' => (int) $row->total,
                ];
            })
            ->filter()
            ->take($leaderboardLimit)
            ->values()
            ->all();

        $stats = [
            'posts' => (clone $postQuery)->count(),
            'comments' => Comment::query()->count(),
            'members' => User::query()->where('is_email_confirmed', true)->count(),
            'online' => $onlineCount,
            'rooms' => $rooms ? count($rooms) : 0,
            'voiceParticipants' => $this->settings->bool('guest_show_participant_counts') || ! $isGuest
                ? RoomParticipant::query()->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(5))->count()
                : null,
            'media' => $this->access->canViewMedia($actor)
                ? \CengizKemec\Social\Models\Media::query()->where('status', 'active')->where('visibility', 'public')->count()
                : null,
        ];

        $roomData = $rooms->map(function (Room $room) use ($isGuest, $actor) {
            $participants = [];
            $liveCount = $room->participants()
                ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
                ->count();

            if (! $isGuest && $room->is_voice) {
                $participants = $room->participants()
                    ->with('user')
                    ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
                    ->orderBy('joined_at')
                    ->limit(60)
                    ->get()
                    ->map(function ($participant) {
                        if (! $participant->user) {
                            return null;
                        }

                        return array_merge($this->users->basic($participant->user), [
                            'role' => $participant->role,
                            'muted' => (bool) $participant->muted,
                            'joinedAt' => $participant->joined_at?->toIso8601String(),
                        ]);
                    })
                    ->filter()
                    ->values()
                    ->all();
            }

            return [
                'id' => (int) $room->id,
                'slug' => $room->slug ?: 'room-'.$room->id,
                'name' => $room->name,
                'description' => $room->description,
                'icon' => $room->icon,
                'categoryId' => $room->category_id,
                'type' => $room->type,
                'visibility' => $room->visibility,
                'capacity' => (int) $room->capacity,
                'participantCount' => (! $isGuest || $this->settings->bool('guest_show_participant_counts')) ? $liveCount : null,
                'isVoice' => (bool) $room->is_voice,
                'isText' => (bool) $room->is_text,
                'isLocked' => (bool) $room->is_locked,
                'hasPassword' => $room->password_hash !== null,
                'canJoin' => ! $isGuest && $this->access->canJoinRoom($room, $actor),
                'canManage' => ! $isGuest && $this->access->canManageRoom($room, $actor),
                'participants' => $participants,
            ];
        })->all();

        $can = [
            'isGuest' => $isGuest,
            'isAdmin' => ! $isGuest && $actor->isAdmin(),
            'viewCommunity' => $canView,
            'viewFeed' => $this->access->canViewFeed($actor),
            'viewMedia' => $this->access->canViewMedia($actor),
            'viewProfiles' => $this->access->canViewProfiles($actor),
            'createPost' => $this->access->canCreatePosts($actor),
            'comment' => $this->access->canComment($actor),
            'react' => $this->access->canReact($actor),
            'bookmark' => $this->access->canBookmark($actor),
            'uploadMedia' => ! $isGuest && $actor->can('social.uploadMedia'),
            'createStory' => $this->access->canCreateStory($actor),
            'createRoom' => $this->access->canCreateRoom($actor),
            'joinRoom' => $this->access->canJoinRooms($actor),
            'useVoice' => $this->access->canUseVoice($actor),
            'useText' => $this->access->canUseText($actor),
            'sendMessage' => $this->access->canSendMessages($actor),
            'sendDirectMessage' => $this->access->canUseDirectMessages($actor),
            'shareScreen' => ! $isGuest && $actor->can('social.shareScreen'),
            'follow' => ! $isGuest && $actor->can('social.follow'),
            'moderatePosts' => ! $isGuest && $actor->can('social.moderatePosts'),
            'moderateMedia' => ! $isGuest && $actor->can('social.moderateMedia'),
            'moderateReports' => ! $isGuest && $actor->can('social.moderateReports'),
            'manageRooms' => ! $isGuest && ($actor->isAdmin() || $actor->can('social.manageAllRooms') || $actor->can('social.manageRooms')),
            'isRestricted' => $this->access->isRestricted($actor),
        ];

        if (! $isGuest) {
            UserStatus::query()->updateOrCreate(
                ['user_id' => $actor->id],
                ['last_online_at' => \Illuminate\Support\now(), 'updated_at' => \Illuminate\Support\now()]
            );
        }

        return $this->json([
            'config' => $this->settings->publicConfig(),
            'user' => $isGuest ? null : $this->users->full($actor, $actor),
            'can' => $can,
            'unreadNotifications' => $this->notifier->unreadCount($actor),
            'stats' => $stats,
            'categories' => $categories,
            'userRoomCategoryIds' => $userRoomCategoryIds,
            'rooms' => $roomData,
            'channels' => $channels,
            'onlineMembers' => $onlineMembers,
            'offlineMembers' => $offlineMembers,
            'leaderboards' => [
                'topPosters' => $topPosters,
                'topLiked' => $topLiked,
                'topPosts' => $topPosts,
                'voiceUsers' => $voiceUsers,
                'voiceRooms' => $voiceRooms,
            ],
            'trendingHashtags' => $trendingHashtags,
            'userId' => $isGuest ? null : (int) $actor->id,
            'csrfToken' => (string) ($request->getAttribute('session')?->token() ?? ''),
            'serverTime' => \Illuminate\Support\now()->toIso8601String(),
        ], 200, ['Cache-Control' => 'private, no-store']);
    }
}
