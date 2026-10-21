# Codex-only identity override. Ordinary git commands retain the human's identity.
$ErrorActionPreference = 'Stop'
$codexGitDir = (git rev-parse --path-format=absolute --git-common-dir).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Run this helper inside the repository.' }
$codexConfig = Join-Path $codexGitDir 'codex-signing/gitconfig'
if (-not (Test-Path -LiteralPath $codexConfig)) {
    throw 'Codex signing is not configured in this checkout. Stop rather than commit unsigned.'
}
foreach ($argument in $args) {
    if ($argument -match '^(--author|--no-gpg-sign|--gpg-sign|--reuse-message|--reedit-message|-S|-C|-c)($|=|.)') {
        throw 'Identity, signing and author-reuse overrides are not accepted by this helper.'
    }
}
if ($args -contains '--amend') {
    $codexPreviousAuthor = git log -1 '--format=%an <%ae>'
    if ($LASTEXITCODE -ne 0 -or $codexPreviousAuthor -ne 'Codex <codex@walquest.invalid>') {
        throw 'This helper only amends existing Codex-authored commits.'
    }
}
$codexIdentity = @{
    GIT_AUTHOR_NAME = 'Codex'
    GIT_AUTHOR_EMAIL = 'codex@walquest.invalid'
    GIT_COMMITTER_NAME = 'Codex'
    GIT_COMMITTER_EMAIL = 'codex@walquest.invalid'
}
$codexPreviousEnvironment = @{}
try {
    foreach ($name in $codexIdentity.Keys) {
        $codexPreviousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $codexIdentity[$name], 'Process')
    }
    git -c "include.path=$codexConfig" commit --gpg-sign @args
    $codexCommitExit = $LASTEXITCODE
} finally {
    foreach ($name in $codexPreviousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $codexPreviousEnvironment[$name], 'Process')
    }
}
exit $codexCommitExit
