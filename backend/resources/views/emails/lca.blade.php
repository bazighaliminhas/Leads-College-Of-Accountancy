@php
    $tones = ['success' => ['#0f8a4b', '#e6f6ed'], 'warn' => ['#b45309', '#fef3e2'], 'danger' => ['#be0002', '#fdecec'], 'info' => ['#13407a', '#e8edf5'], 'live' => ['#be0002', '#fdecec']];
    [$accent, $soft] = $tones[$p['tone'] ?? 'info'] ?? $tones['info'];
    $intro = (array) ($p['intro'] ?? []);
    $outro = (array) ($p['outro'] ?? []);
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>{{ $p['subject'] ?? $college }}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#334155;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{ $p['preheader'] ?? ($p['title'] ?? '') }}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

    {{-- Header --}}
    <tr><td style="background:#012147;border-radius:14px 14px 0 0;padding:22px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
                <img src="{{ $site }}/app/lca-crest.png" width="44" height="44" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:12px;background:#fff;border-radius:50%;">
                <span style="display:inline-block;vertical-align:middle;color:#ffffff;">
                    <strong style="font-size:17px;letter-spacing:.2px;">Leads College</strong><br>
                    <span style="font-size:12px;color:#c7d2e3;letter-spacing:.5px;text-transform:uppercase;">of Accountancy</span>
                </span>
            </td>
            <td align="right" style="vertical-align:middle;font-size:12px;color:#c7d2e3;">{{ $p['badge'] ?? 'ACCA · CA (ICAP)' }}</td>
        </tr></table>
    </td></tr>
    <tr><td style="height:4px;background:#be0002;line-height:4px;font-size:0;">&nbsp;</td></tr>

    {{-- Body --}}
    <tr><td style="background:#ffffff;padding:32px 28px 8px;">
        @if(!empty($p['eyebrow']))
            <div style="display:inline-block;background:{{ $soft }};color:{{ $accent }};font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin-bottom:14px;">{{ $p['eyebrow'] }}</div>
        @endif
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f1b2d;font-weight:800;">{{ $p['title'] ?? $p['subject'] }}</h1>
        @if(!empty($p['greeting']))<p style="margin:0 0 14px;font-size:15px;line-height:1.65;">{{ $p['greeting'] }}</p>@endif
        @foreach($intro as $line)
            <p style="margin:0 0 14px;font-size:15px;line-height:1.65;">{!! nl2br(e($line)) !!}</p>
        @endforeach

        @if(!empty($p['details']))
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 22px;background:#f6f8fb;border:1px solid #e2e8f0;border-radius:12px;">
                @foreach($p['details'] as $label => $value)
                    <tr>
                        <td style="padding:11px 16px;font-size:13px;color:#64748b;width:38%;vertical-align:top;{{ !$loop->last ? 'border-bottom:1px solid #e2e8f0;' : '' }}">{{ $label }}</td>
                        <td style="padding:11px 16px;font-size:14px;color:#0f1b2d;font-weight:600;vertical-align:top;word-break:break-word;{{ !$loop->last ? 'border-bottom:1px solid #e2e8f0;' : '' }}">
                            @if(is_string($value) && preg_match('#^https?://#', $value))<a href="{{ $value }}" style="color:#13407a;">{{ $value }}</a>@else{{ $value }}@endif
                        </td>
                    </tr>
                @endforeach
            </table>
        @endif

        @if(!empty($p['cta']))
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 10px;"><tr>
                <td style="border-radius:10px;background:{{ ($p['tone'] ?? '') === 'live' ? '#be0002' : '#012147' }};">
                    <a href="{{ $p['cta']['url'] }}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">{{ $p['cta']['label'] }} &rarr;</a>
                </td>
                @if(!empty($p['cta2']))
                    <td style="width:10px;">&nbsp;</td>
                    <td style="border-radius:10px;border:1.5px solid #cbd5e1;">
                        <a href="{{ $p['cta2']['url'] }}" style="display:inline-block;padding:12.5px 20px;font-size:14px;font-weight:700;color:#012147;text-decoration:none;border-radius:10px;">{{ $p['cta2']['label'] }}</a>
                    </td>
                @endif
            </tr></table>
        @endif

        @foreach($outro as $line)
            <p style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#475569;">{!! nl2br(e($line)) !!}</p>
        @endforeach
        <p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#475569;">Regards,<br><strong style="color:#0f1b2d;">{{ $college }}</strong><br><span style="color:#64748b;">Admissions &amp; Student Affairs</span></p>
    </td></tr>

    {{-- Footer --}}
    <tr><td style="background:#ffffff;border-radius:0 0 14px 14px;padding:18px 28px 26px;border-top:1px solid #eef2f7;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
            You received this email because you have an account or enquiry with {{ $college }}.
            @if(!empty($p['cta']))<br>If the button doesn't work, copy this link: <a href="{{ $p['cta']['url'] }}" style="color:#64748b;">{{ $p['cta']['url'] }}</a>@endif
        </p>
        <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;"><a href="{{ $site }}" style="color:#64748b;">{{ preg_replace('#^https?://#', '', $site) }}</a> &middot; Learn &bull; Lead &bull; Achieve</p>
    </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
