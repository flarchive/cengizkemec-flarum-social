<?php

namespace CengizKemec\Social\Console;

use CengizKemec\Social\Cleanup\CleanupService;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Console\AbstractCommand;
use Symfony\Component\Console\Input\InputOption;

class CleanupCommand extends AbstractCommand
{
    public function __construct(
        protected CleanupService $cleanup,
        protected SocialSettings $settings
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->setName('social:cleanup')
            ->setDescription('Clean up expired stories, unreferenced media, empty temporary rooms and old direct messages.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Report what would be deleted without deleting anything.')
            ->addOption('only', null, InputOption::VALUE_REQUIRED, 'Limit to media, rooms, stories or messages.', 'all')
            ->addOption('force', null, InputOption::VALUE_NONE, 'Run even when automatic cleanup is disabled in the ACP.');
    }

    protected function fire(): int
    {
        $dryRun = (bool) $this->input->getOption('dry-run');
        $only = (string) $this->input->getOption('only');

        if (! in_array($only, ['all', 'media', 'rooms', 'stories', 'messages'], true)) {
            $this->error('Invalid --only value. Use all, media, rooms, stories or messages.');

            return 1;
        }

        if (! $this->settings->bool('cleanup_enabled') && ! $this->input->getOption('force') && ! $dryRun) {
            $this->info('Automatic media cleanup is disabled in the ACP. Use --force to run it anyway.');

            return 0;
        }

        $stats = $this->cleanup->run($dryRun, $only);

        $this->info($dryRun ? 'Dry run completed:' : 'Cleanup completed:');
        $this->info(json_encode($stats, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return 0;
    }
}
