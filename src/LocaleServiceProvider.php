<?php

namespace CengizKemec\Social;

use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Locale\LocaleManager;

/**
 * Flarum only lists locales that a language pack registers. flarum-social ships
 * its own Turkish translation, so register the locale as well.
 */
class LocaleServiceProvider extends AbstractServiceProvider
{
    public function boot(): void
    {
        $locales = $this->container->make(LocaleManager::class);

        if (! $locales->hasLocale('tr')) {
            $locales->addLocale('tr', 'Türkçe');
        }
    }
}
