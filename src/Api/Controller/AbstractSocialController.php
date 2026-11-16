<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

abstract class AbstractSocialController implements RequestHandlerInterface
{
    public function __construct(
        protected Access $access,
        protected SocialSettings $settings,
        protected TranslatorInterface $translator
    ) {
    }

    abstract protected function dispatch(ServerRequestInterface $request): ResponseInterface;

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->access->requireEnabled();

        return $this->dispatch($request);
    }

    protected function actor(ServerRequestInterface $request): User
    {
        return RequestUtil::getActor($request);
    }

    protected function routeName(ServerRequestInterface $request): string
    {
        return (string) $request->getAttribute('routeName');
    }

    protected function routeParam(ServerRequestInterface $request, string $key, mixed $default = null): mixed
    {
        return $request->getQueryParams()[$key] ?? $default;
    }

    protected function body(ServerRequestInterface $request): array
    {
        $body = $request->getParsedBody();

        return is_array($body) ? $body : [];
    }

    protected function json(mixed $data, int $status = 200, array $headers = []): JsonResponse
    {
        $response = new JsonResponse($data, $status);

        foreach ($headers as $name => $value) {
            $response = $response->withHeader($name, $value);
        }

        return $response;
    }

    /**
     * @return array{0: int, 1: int}
     */
    protected function pagination(ServerRequestInterface $request, int $default = 20, int $max = 50): array
    {
        $query = $request->getQueryParams();
        $page = $query['page'] ?? [];
        $offset = (int) ($page['offset'] ?? $query['offset'] ?? 0);
        $limit = (int) ($page['limit'] ?? $query['limit'] ?? $default);

        return [max(0, $offset), max(1, min($max, $limit ?: $default))];
    }

    protected function validationError(string $key, array $params = []): never
    {
        throw new ValidationException([
            $key => $this->translator->trans('cengizkemec-social.api.errors.'.$key, $params),
        ]);
    }

    protected function notFound(string $messageKey = 'not_found'): JsonResponse
    {
        return new JsonResponse([
            'errors' => [[
                'status' => '404',
                'code' => $messageKey,
                'detail' => $this->translator->trans('cengizkemec-social.api.errors.'.$messageKey),
            ]],
        ], 404);
    }

    protected function forbidden(string $messageKey = 'forbidden'): JsonResponse
    {
        return new JsonResponse([
            'errors' => [[
                'status' => '403',
                'code' => $messageKey,
                'detail' => $this->translator->trans('cengizkemec-social.api.errors.'.$messageKey),
            ]],
        ], 403);
    }

    protected function cleanString(mixed $value, int $maxLength = 5000): string
    {
        $value = is_string($value) ? trim($value) : '';

        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $maxLength);
        }

        return substr($value, 0, $maxLength);
    }

    protected function intArray(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map('intval', $value), fn ($id) => $id > 0)));
    }

    protected function iso(?object $date): ?string
    {
        return $date ? $date->toIso8601String() : null;
    }

    /**
     * Record a Social action in flarum/audit when that extension is enabled.
     * Audit is optional, so failures never affect the action itself.
     */
    protected function audit(string $action, array $payload = []): void
    {
        try {
            resolve(\CengizKemec\Social\Support\Audit::class)->log($action, $payload);
        } catch (\Throwable $e) {
            // Never let logging break the user-facing action.
        }
    }
}
