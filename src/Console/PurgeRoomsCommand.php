<?php

namespace CengizKemec\Social\Console;

use CengizKemec\Social\Cleanup\CleanupService;
use Flarum\Console\AbstractCommand;

class PurgeRoomsCommand extends AbstractCommand
{
    public function __construct(protected CleanupService $cleanup)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->setName('social:purge-rooms')
            ->setDescription('Delete temporary rooms that have been empty longer than the configured grace period.');
    }

    protected function fire(): int
    {
        $deleted = $this->cleanup->purgeEmptyTemporaryRooms();

        $this->info("Deleted {$deleted} empty temporary room(s).");

        return 0;
    }
}
