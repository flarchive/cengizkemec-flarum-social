import Extend from 'flarum/common/extenders';
import app from 'flarum/forum/app';
import FeedPage from './pages/FeedPage';
import ExplorePage from './pages/ExplorePage';
import MediaPage from './pages/MediaPage';
import RoomsPage from './pages/RoomsPage';
import RoomPage from './pages/RoomPage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import BookmarksPage from './pages/BookmarksPage';
import ProfilePage from './pages/ProfilePage';
import PostPage from './pages/PostPage';
import ChannelPage from './pages/ChannelPage';

export default [
  new Extend.Routes()
    .add('social.index', '/social', FeedPage)
    .add('social.feed', '/social/feed', FeedPage)
    .add('social.explore', '/social/explore', ExplorePage)
    .add('social.media', '/social/media', MediaPage)
    .add('social.rooms', '/social/rooms', RoomsPage)
    .add('social.room', '/social/rooms/:slug', RoomPage)
    .add('social.messages', '/social/messages', MessagesPage)
    .add('social.messages.conversation', '/social/messages/:id', MessagesPage)
    .add('social.notifications', '/social/notifications', NotificationsPage)
    .add('social.bookmarks', '/social/bookmarks', BookmarksPage)
    .add('social.profile', '/social/profile/:username', ProfilePage)
    .add('social.post', '/social/post/:id', PostPage)
    .add('social.channel', '/social/channels/:id', ChannelPage),
];
