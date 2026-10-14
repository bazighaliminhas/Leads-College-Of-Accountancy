<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * WhatsApp transport via Kapso (Meta WhatsApp Cloud API proxy).
 * Docs: https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message
 *
 * Business events (orders, payments, live classes…) are composed in App\Support\Notify,
 * which queues messages through App\Jobs\SendWhatsApp. This class only formats numbers and sends.
 *
 * Note: Meta only allows free-form text inside the 24-hour customer-service window.
 * If a message is refused for that reason and KAPSO_TEMPLATE_NAME is set, it is re-sent
 * as that approved template with the text as its {{1}} parameter.
 */
class WhatsApp
{
    public static function enabled(): bool
    {
        return (bool) config('whatsapp.enabled') && config('whatsapp.api_key') && config('whatsapp.phone_number_id');
    }

    /** Normalise to E.164 (e.g. 03001234567 -> +923001234567). */
    public static function formatPhone(?string $phone): ?string
    {
        if (!$phone) return null;
        $clean = preg_replace('/[^\d+]/', '', trim($phone));
        if ($clean === '' || $clean === null) return null;
        if (str_starts_with($clean, '00')) $clean = '+'.substr($clean, 2);
        if (preg_match('/^0(3\d{9})$/', $clean, $m)) $clean = '+92'.$m[1];
        if (preg_match('/^(3\d{9})$/', $clean, $m)) $clean = '+92'.$m[1];
        if (!str_starts_with($clean, '+') && strlen($clean) >= 10) $clean = '+'.$clean;
        return strlen($clean) >= 11 ? $clean : null;
    }

    /** @return array{success: bool, status?: int, error?: string, data?: mixed, skipped?: bool} */
    public static function send(string $phone, string $message): array
    {
        if (!config('whatsapp.enabled')) return ['success' => false, 'skipped' => true, 'error' => 'WhatsApp is disabled (WHATSAPP_ENABLED=false).'];
        $apiKey = config('whatsapp.api_key');
        $phoneId = config('whatsapp.phone_number_id');
        if (!$apiKey || !$phoneId) return ['success' => false, 'skipped' => true, 'error' => 'KAPSO_API_KEY / KAPSO_PHONE_NUMBER_ID missing in .env'];

        $to = self::formatPhone($phone);
        if (!$to) return ['success' => false, 'error' => "Invalid phone number: {$phone}"];

        $url = rtrim(config('whatsapp.api_base'), '/')."/{$phoneId}/messages";
        $http = fn () => Http::timeout(15)->acceptJson()->withHeaders(['X-API-Key' => $apiKey]);
        $digits = ltrim($to, '+');

        try {
            $res = $http()->post($url, [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $digits,
                'type' => 'text',
                'text' => ['preview_url' => true, 'body' => mb_substr($message, 0, 4096)],
            ]);

            // 24h window closed -> fall back to an approved template, if configured
            if (!$res->successful() && ($template = config('whatsapp.template_name'))) {
                $param = trim(preg_replace('/\s{2,}/', ' ', str_replace(["\r", "\n", "\t", '*'], [' ', ' ', ' ', ''], $message)));
                $res = $http()->post($url, [
                    'messaging_product' => 'whatsapp',
                    'recipient_type' => 'individual',
                    'to' => $digits,
                    'type' => 'template',
                    'template' => [
                        'name' => $template,
                        'language' => ['code' => config('whatsapp.template_lang', 'en')],
                        'components' => [['type' => 'body', 'parameters' => [['type' => 'text', 'text' => mb_substr($param, 0, 1000)]]]],
                    ],
                ]);
            }

            if ($res->successful()) return ['success' => true, 'status' => $res->status(), 'data' => $res->json()];
            Log::warning("[WhatsApp] {$to} failed ({$res->status()}): ".mb_substr($res->body(), 0, 500));
            return ['success' => false, 'status' => $res->status(), 'error' => mb_substr($res->body(), 0, 1000)];
        } catch (\Throwable $e) {
            Log::error("[WhatsApp] {$to} exception: ".$e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
