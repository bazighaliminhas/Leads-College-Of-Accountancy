{{ $p['title'] ?? $p['subject'] }}

@if(!empty($p['greeting'])){{ $p['greeting'] }}

@endif
@foreach((array) ($p['intro'] ?? []) as $line){{ $line }}

@endforeach
@foreach(($p['details'] ?? []) as $k => $v){{ $k }}: {{ $v }}
@endforeach
@if(!empty($p['cta']))

{{ $p['cta']['label'] }}: {{ $p['cta']['url'] }}
@endif
@if(!empty($p['cta2'])){{ $p['cta2']['label'] }}: {{ $p['cta2']['url'] }}
@endif
@foreach((array) ($p['outro'] ?? []) as $line)

{{ $line }}
@endforeach

Regards,
{{ $college }}
{{ $site }}
