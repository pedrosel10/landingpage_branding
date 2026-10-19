<?php
/* Biblioteca comum do formulário e do painel.
   Os contatos ficam num arquivo de linhas JSON guardado FORA da pasta do
   site: no cPanel o deploy roda `cp -R * $HOME/public_html`, então tudo que
   mora um nível acima de public_html sobrevive a qualquer publicação. */

/* Ninguém abre este arquivo direto */
if (realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    http_response_code(404);
    exit;
}

define('BD_ARQUIVO_LEADS', 'leads.jsonl');
define('BD_ARQUIVO_CONFIG', 'config.json');

/* Pasta dos dados, criada na primeira gravação.
   1ª opção: $HOME/branding_dados — fora do site, intocada pelo deploy.
   2ª opção: .dados dentro do site — começa com ponto, e `cp -R *` também
   não leva nomes assim, então ela igualmente sobrevive. */
function bd_pasta()
{
    static $pasta = null;
    if ($pasta !== null) {
        return $pasta;
    }

    $raiz = dirname(__DIR__);
    foreach ([$raiz . '/branding_dados', __DIR__ . '/.dados'] as $tentativa) {
        if (!is_dir($tentativa)) {
            @mkdir($tentativa, 0700, true);
        }
        if (is_dir($tentativa) && is_writable($tentativa)) {
            $pasta = $tentativa;
            break;
        }
    }

    if ($pasta === null) {
        return null;
    }

    /* Se a pasta acabou caindo dentro do site, o Apache não serve nada dela */
    $guarda = $pasta . '/.htaccess';
    if (!file_exists($guarda)) {
        @file_put_contents($guarda, "Require all denied\nDeny from all\n");
    }

    return $pasta;
}

function bd_caminho($arquivo)
{
    $pasta = bd_pasta();
    return $pasta === null ? null : $pasta . '/' . $arquivo;
}

/* ---------------------------------------------------------------- contatos */

function bd_lead_novo(array $campos)
{
    return [
        'id'       => bin2hex(random_bytes(8)),
        'criado'   => date('c'),
        'nome'     => $campos['nome'],
        'nicho'    => $campos['nicho'],
        'email'    => $campos['email'],
        'telefone' => $campos['telefone'],
        'origem'   => $campos['origem'] ?? '',
        'status'   => 'novo',
    ];
}

function bd_gravar(array $lead)
{
    $caminho = bd_caminho(BD_ARQUIVO_LEADS);
    if ($caminho === null) {
        return false;
    }
    $linha = json_encode($lead, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return (bool) @file_put_contents($caminho, $linha . "\n", FILE_APPEND | LOCK_EX);
}

/* Mais recentes primeiro */
function bd_listar()
{
    $caminho = bd_caminho(BD_ARQUIVO_LEADS);
    if ($caminho === null || !is_file($caminho)) {
        return [];
    }

    $leads = [];
    foreach (file($caminho, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
        $lead = json_decode($linha, true);
        if (is_array($lead) && isset($lead['id'])) {
            $leads[] = $lead;
        }
    }

    return array_reverse($leads);
}

/* Reescreve o arquivo inteiro. Só o painel usa, e um usuário de cada vez. */
function bd_regravar(array $leads)
{
    $caminho = bd_caminho(BD_ARQUIVO_LEADS);
    if ($caminho === null) {
        return false;
    }

    $texto = '';
    foreach (array_reverse($leads) as $lead) {
        $texto .= json_encode($lead, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    }

    return (bool) @file_put_contents($caminho, $texto, LOCK_EX);
}

/* ----------------------------------------------------------------- limpeza */

/* Tira quebras de linha para ninguém injetar cabeçalho no e-mail */
function bd_limpa($valor, $limite = 200)
{
    $valor = trim(preg_replace('/[\r\n\t]+/', ' ', (string) $valor));
    return mb_substr($valor, 0, $limite);
}

/* ------------------------------------------------------------------ config */

function bd_config()
{
    $caminho = bd_caminho(BD_ARQUIVO_CONFIG);
    if ($caminho === null || !is_file($caminho)) {
        return [];
    }
    $config = json_decode((string) @file_get_contents($caminho), true);
    return is_array($config) ? $config : [];
}

function bd_config_salvar(array $config)
{
    $caminho = bd_caminho(BD_ARQUIVO_CONFIG);
    if ($caminho === null) {
        return false;
    }
    $ok = (bool) @file_put_contents(
        $caminho,
        json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    );
    if ($ok) {
        @chmod($caminho, 0600);
    }
    return $ok;
}
