<?php

return [
    // Master switch for WhatsApp messages
    'enabled' => env('WHATSAPP_ENABLED', true),

    // Kapso (Meta WhatsApp Cloud API proxy) — https://docs.kapso.ai
    'api_key' => env('KAPSO_API_KEY'),
    'phone_number_id' => env('KAPSO_PHONE_NUMBER_ID'),
    'api_base' => env('KAPSO_API_BASE', 'https://api.kapso.ai/meta/whatsapp/v24.0'),

    // Optional approved template used when the 24-hour window is closed.
    // Create a "Utility" template whose body contains one variable, e.g.  "Leads College update: {{1}}"
    'template_name' => env('KAPSO_TEMPLATE_NAME'),
    'template_lang' => env('KAPSO_TEMPLATE_LANG', 'en'),

    // Where admin alerts are delivered
    'admin_phone' => env('ADMIN_WHATSAPP_NUMBER'),
    'admin_email' => env('ADMIN_EMAIL'),
];
