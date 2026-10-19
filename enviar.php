<?php
/* Recebe o formulário da última cena.
   Responde sempre em JSON: o main.js só considera enviado quando vem ok=true,
   e o ok depende de o contato ter sido GRAVADO — se o e-mail falhar, o lead
   continua no painel. Troque $PARA pelo endereço que deve ser avisado. */

$PARA    = 'rodrigoselestrim@gmail.com';
$ASSUNTO = 'Novo contato pelo site';

require __DIR__ . '/dados.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'erro' => 'metodo']);
    exit;
}

$dados = json_decode(file_get_contents('php://input'), true);
if (!is_array($dados)) {
    $dados = $_POST;
}

/* Isca: o campo fica fora da tela, então só robô preenche. Responde ok para
   ele seguir embora achando que deu certo, e não grava nada. */
if (bd_limpa($dados['site'] ?? '') !== '') {
    echo json_encode(['ok' => true]);
    exit;
}

$campos = [
    'nome'     => bd_limpa($dados['nome'] ?? '', 120),
    'nicho'    => bd_limpa($dados['nicho'] ?? '', 120),
    'email'    => bd_limpa($dados['email'] ?? '', 160),
    'telefone' => bd_limpa($dados['telefone'] ?? '', 40),
    'origem'   => bd_limpa($dados['origem'] ?? '', 300),
];

if ($campos['nome'] === '' || $campos['nicho'] === '' || $campos['telefone'] === ''
    || !filter_var($campos['email'], FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'erro' => 'dados']);
    exit;
}

$lead = bd_lead_novo($campos);

if (!bd_gravar($lead)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'erro' => 'gravacao']);
    exit;
}

/* Aviso por e-mail. Se cair, o contato já está salvo no painel. */
$corpo = "Nome: {$lead['nome']}\n"
       . "Nicho: {$lead['nicho']}\n"
       . "E-mail: {$lead['email']}\n"
       . "WhatsApp: {$lead['telefone']}\n\n"
       . 'Enviado em ' . date('d/m/Y H:i') . "\n";

$cabecalhos = implode("\r\n", [
    'From: Site Branding <no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '>',
    'Reply-To: ' . $lead['email'],
    'Content-Type: text/plain; charset=utf-8',
]);

@mail($PARA, $ASSUNTO, $corpo, $cabecalhos);

echo json_encode(['ok' => true]);
