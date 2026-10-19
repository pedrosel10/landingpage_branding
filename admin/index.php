<?php
/* Painel dos contatos do site — pedroselestrim.com/admin
   Os dados vêm de dados.php, que guarda tudo fora da pasta publicada.
   Na primeira visita o painel pede para definir a senha; o hash fica junto
   dos dados, nunca neste arquivo. */

require dirname(__DIR__) . '/dados.php';

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => !empty($_SERVER['HTTPS']),
]);
session_start();

$config    = bd_config();
$instalado = isset($config['senha']);
$logado    = !empty($_SESSION['admin']);
$erro      = '';
$aviso     = '';

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

function csrf_ok()
{
    return isset($_POST['csrf'], $_SESSION['csrf'])
        && hash_equals($_SESSION['csrf'], $_POST['csrf']);
}

/* Volta para a própria URL. Não dá para mandar 'index.php': quem abriu
   /admin sem barra seria jogado na raiz do site. */
function voltar($query = '')
{
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?') . $query);
    exit;
}

if (bd_pasta() === null) {
    $erro = 'Não consegui criar a pasta dos dados. Confira as permissões da conta.';
}

/* --------------------------------------------------------------- ações */

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $erro === '') {
    if (!csrf_ok()) {
        $erro = 'Sessão expirada. Tente de novo.';
    } elseif (!$instalado && isset($_POST['nova_senha'])) {
        /* Primeira visita: definir a senha */
        $senha = (string) $_POST['nova_senha'];
        if (mb_strlen($senha) < 8) {
            $erro = 'A senha precisa ter pelo menos 8 caracteres.';
        } elseif ($senha !== ($_POST['repetir_senha'] ?? '')) {
            $erro = 'As duas senhas não são iguais.';
        } else {
            bd_config_salvar(['senha' => password_hash($senha, PASSWORD_DEFAULT)]);
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            voltar();
        }
    } elseif ($instalado && !$logado && isset($_POST['senha'])) {
        /* Login, com espera depois de erros seguidos */
        $bloqueio = (int) ($config['bloqueio_ate'] ?? 0);
        if ($bloqueio > time()) {
            $erro = 'Muitas tentativas. Tente de novo em '
                . ceil(($bloqueio - time()) / 60) . ' min.';
        } elseif (password_verify((string) $_POST['senha'], $config['senha'])) {
            $config['tentativas'] = 0;
            $config['bloqueio_ate'] = 0;
            bd_config_salvar($config);
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            voltar();
        } else {
            $config['tentativas'] = (int) ($config['tentativas'] ?? 0) + 1;
            if ($config['tentativas'] >= 5) {
                $config['tentativas'] = 0;
                $config['bloqueio_ate'] = time() + 900;
            }
            bd_config_salvar($config);
            sleep(1);
            $erro = 'Senha incorreta.';
        }
    } elseif ($logado && isset($_POST['acao'])) {
        $id    = (string) ($_POST['id'] ?? '');
        $leads = bd_listar();

        if ($_POST['acao'] === 'sair') {
            $_SESSION = [];
            session_destroy();
            voltar();
        }

        foreach ($leads as $i => $lead) {
            if ($lead['id'] !== $id) {
                continue;
            }
            if ($_POST['acao'] === 'alternar') {
                $leads[$i]['status'] = ($lead['status'] ?? 'novo') === 'novo'
                    ? 'atendido' : 'novo';
            } elseif ($_POST['acao'] === 'excluir') {
                unset($leads[$i]);
            }
            break;
        }

        bd_regravar(array_values($leads));
        voltar('?' . http_build_query(['filtro' => $_POST['filtro'] ?? 'todos']));
    }
}

/* ------------------------------------------------------------- listagem */

$leads  = $logado ? bd_listar() : [];
$novos  = 0;
foreach ($leads as $lead) {
    if (($lead['status'] ?? 'novo') === 'novo') {
        $novos++;
    }
}

$filtro = $_GET['filtro'] ?? 'todos';
$visiveis = array_values(array_filter($leads, function ($lead) use ($filtro) {
    if ($filtro === 'novos')    return ($lead['status'] ?? 'novo') === 'novo';
    if ($filtro === 'atendidos') return ($lead['status'] ?? 'novo') === 'atendido';
    return true;
}));

/* Exportação em CSV, com BOM para o Excel abrir os acentos certos */
if ($logado && ($_GET['exportar'] ?? '') === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="contatos-' . date('Y-m-d') . '.csv"');
    $saida = fopen('php://output', 'w');
    fwrite($saida, "\xEF\xBB\xBF");
    /* Os cinco argumentos são de propósito: a partir do PHP 8.4 omitir o
       escape vira aviso, e um aviso no meio do arquivo estraga o CSV. */
    fputcsv($saida, ['Data', 'Nome', 'Nicho', 'E-mail', 'WhatsApp', 'Status'], ',', '"', '\\');
    foreach ($leads as $lead) {
        fputcsv($saida, [
            date('d/m/Y H:i', strtotime($lead['criado'])),
            $lead['nome'], $lead['nicho'], $lead['email'], $lead['telefone'],
            $lead['status'] ?? 'novo',
        ], ',', '"', '\\');
    }
    exit;
}

function e($texto)
{
    return htmlspecialchars((string) $texto, ENT_QUOTES, 'UTF-8');
}

$csrf = $_SESSION['csrf'];
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Contatos | Branding</title>
<style>
  @font-face {
    font-family: 'PP Editorial New';
    src: url('../PPEditorialNew-Regular.otf') format('opentype');
    font-weight: 400; font-display: swap;
  }
  @font-face {
    font-family: 'Neue Montreal';
    src: url('../NeueMontreal-Regular.otf') format('opentype');
    font-weight: 400; font-display: swap;
  }

  :root {
    --bg: #E8FFA3;
    --dark: #181818;
    --linha: rgba(24, 24, 24, 0.16);
    --suave: rgba(24, 24, 24, 0.58);
    --serif: 'PP Editorial New', Georgia, serif;
    --sans: 'Neue Montreal', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-font-smoothing: antialiased; }

  body {
    background: var(--bg);
    color: var(--dark);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.5;
    padding: clamp(24px, 5vw, 56px) clamp(16px, 4vw, 48px);
  }

  .topo {
    display: flex; flex-wrap: wrap; align-items: baseline;
    justify-content: space-between; gap: 16px;
    padding-bottom: 20px; border-bottom: 1px solid var(--linha);
  }
  h1 { font-family: var(--serif); font-weight: 400; font-size: clamp(1.9rem, 4vw, 2.8rem); letter-spacing: -0.015em; }
  .contagem { color: var(--suave); font-size: 0.88rem; }

  .barra { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; margin: 22px 0 10px; }
  .filtro { color: var(--suave); text-decoration: none; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 3px; border-bottom: 1px solid transparent; }
  .filtro.ativo { color: var(--dark); border-bottom-color: var(--dark); }
  .barra .direita { margin-left: auto; display: flex; gap: 18px; align-items: center; }

  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th {
    text-align: left; font-weight: 400; font-size: 0.72rem;
    text-transform: uppercase; letter-spacing: 0.12em; color: var(--suave);
    padding: 14px 12px 10px 0; border-bottom: 1px solid var(--linha);
  }
  td { padding: 15px 12px 15px 0; border-bottom: 1px solid var(--linha); vertical-align: top; }
  tr.atendido td { color: var(--suave); }
  .quando { font-size: 0.82rem; color: var(--suave); white-space: nowrap; }
  .nome { font-size: 1.02rem; }
  td a { color: inherit; }
  .acoes { text-align: right; white-space: nowrap; }

  button {
    font-family: var(--sans); font-size: 0.8rem; cursor: pointer;
    background: none; border: none; color: var(--dark);
    border-bottom: 1px solid var(--linha); padding: 0 0 2px;
  }
  button:hover { border-bottom-color: var(--dark); }
  button.perigo:hover { color: #B3261E; border-bottom-color: #B3261E; }
  form.linha { display: inline; margin-left: 14px; }

  .vazio { padding: 64px 0; text-align: center; color: var(--suave); }

  .entrada { max-width: 360px; margin: 14vh auto 0; }
  .entrada h1 { margin-bottom: 8px; }
  .entrada p { color: var(--suave); margin-bottom: 28px; }
  .entrada label { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--suave); margin-bottom: 6px; }
  .entrada input {
    width: 100%; font-family: var(--sans); font-size: 1rem; color: var(--dark);
    background: none; border: none; border-bottom: 1px solid rgba(24,24,24,0.3);
    padding: 6px 0 9px; margin-bottom: 22px; border-radius: 0;
  }
  .entrada input:focus { outline: none; border-bottom-color: var(--dark); }
  .entrada .enviar {
    background: var(--dark); color: #fff; border: none; width: 100%;
    padding: 13px; font-size: 0.92rem; border-bottom: none;
  }
  .entrada .enviar:hover { background: #00B183; }

  .erro { color: #B3261E; font-size: 0.88rem; margin-bottom: 18px; }

  @media (max-width: 720px) {
    thead { display: none; }
    tr { display: block; padding: 16px 0; border-bottom: 1px solid var(--linha); }
    td { display: block; border: none; padding: 2px 0; }
    .acoes { text-align: left; padding-top: 12px; }
    form.linha { margin: 0 18px 0 0; }
  }
</style>
</head>
<body>

<?php if (!$instalado): ?>

  <div class="entrada">
    <h1>Primeiro acesso</h1>
    <p>Defina a senha do painel. Faça isso agora: até você definir, qualquer pessoa que abrir esta página pode definir.</p>
    <?php if ($erro): ?><p class="erro"><?= e($erro) ?></p><?php endif; ?>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <label for="s1">Senha</label>
      <input id="s1" type="password" name="nova_senha" autocomplete="new-password" required>
      <label for="s2">Repita a senha</label>
      <input id="s2" type="password" name="repetir_senha" autocomplete="new-password" required>
      <button class="enviar" type="submit">Definir senha</button>
    </form>
  </div>

<?php elseif (!$logado): ?>

  <div class="entrada">
    <h1>Contatos</h1>
    <p>Painel restrito.</p>
    <?php if ($erro): ?><p class="erro"><?= e($erro) ?></p><?php endif; ?>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <label for="s">Senha</label>
      <input id="s" type="password" name="senha" autocomplete="current-password" autofocus required>
      <button class="enviar" type="submit">Entrar</button>
    </form>
  </div>

<?php else: ?>

  <div class="topo">
    <h1>Contatos</h1>
    <p class="contagem">
      <?= count($leads) ?> no total<?= $novos ? ' · ' . $novos . ' sem atender' : '' ?>
    </p>
  </div>

  <?php if ($erro): ?><p class="erro" style="margin-top:18px"><?= e($erro) ?></p><?php endif; ?>

  <div class="barra">
    <?php foreach (['todos' => 'Todos', 'novos' => 'Sem atender', 'atendidos' => 'Atendidos'] as $chave => $rotulo): ?>
      <a class="filtro <?= $filtro === $chave ? 'ativo' : '' ?>"
         href="?filtro=<?= $chave ?>"><?= $rotulo ?></a>
    <?php endforeach; ?>
    <span class="direita">
      <a class="filtro" href="?exportar=csv">Baixar CSV</a>
      <form method="post" class="linha">
        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
        <button type="submit" name="acao" value="sair">Sair</button>
      </form>
    </span>
  </div>

  <?php if (!$visiveis): ?>
    <p class="vazio">Nada por aqui ainda.</p>
  <?php else: ?>
    <table>
      <thead>
        <tr>
          <th>Quando</th><th>Nome</th><th>Nicho</th><th>E-mail</th><th>WhatsApp</th><th></th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($visiveis as $lead):
          $atendido = ($lead['status'] ?? 'novo') === 'atendido';
          $zap = preg_replace('/\D/', '', $lead['telefone']);
          if (strlen($zap) <= 11) { $zap = '55' . $zap; }
        ?>
        <tr class="<?= $atendido ? 'atendido' : '' ?>">
          <td class="quando"><?= e(date('d/m/Y H:i', strtotime($lead['criado']))) ?></td>
          <td class="nome"><?= e($lead['nome']) ?></td>
          <td><?= e($lead['nicho']) ?></td>
          <td><a href="mailto:<?= e($lead['email']) ?>"><?= e($lead['email']) ?></a></td>
          <td><a href="https://wa.me/<?= e($zap) ?>" target="_blank" rel="noopener"><?= e($lead['telefone']) ?></a></td>
          <td class="acoes">
            <form method="post" class="linha">
              <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
              <input type="hidden" name="id" value="<?= e($lead['id']) ?>">
              <input type="hidden" name="filtro" value="<?= e($filtro) ?>">
              <button type="submit" name="acao" value="alternar">
                <?= $atendido ? 'Reabrir' : 'Atendido' ?>
              </button>
            </form>
            <form method="post" class="linha"
                  onsubmit="return confirm('Excluir o contato de <?= e($lead['nome']) ?>?')">
              <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
              <input type="hidden" name="id" value="<?= e($lead['id']) ?>">
              <input type="hidden" name="filtro" value="<?= e($filtro) ?>">
              <button type="submit" name="acao" value="excluir" class="perigo">Excluir</button>
            </form>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>

<?php endif; ?>

</body>
</html>
