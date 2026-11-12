<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $body
 * @property string $visibility
 * @property bool $is_pinned
 * @property bool $is_announcement
 * @property int $comments_count
 * @property int $reactions_count
 * @property array|null $hashtags
 * @property array|null $mentions
 * @property \Carbon\Carbon|null $created_at
 */
class Post extends AbstractModel
{
    protected $table = 'social_posts';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'is_pinned' => 'boolean',
        'is_announcement' => 'boolean',
        'comments_count' => 'integer',
        'reactions_count' => 'integer',
        'hashtags' => 'array',
        'mentions' => 'array',
        'edited_at' => 'datetime',
        'deleted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return HasMany<Comment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class, 'post_id');
    }

    /** @return HasMany<Reaction, $this> */
    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class, 'reactable_id')->where('reactable_type', 'post');
    }

    /** @return HasMany<MediaReference, $this> */
    public function mediaReferences(): HasMany
    {
        return $this->hasMany(MediaReference::class, 'reference_id')->where('reference_type', 'post');
    }
}
