// Gera release/UCOP.apk (app de celular: fichas, rituais e rolagens ligadas à mesa).
// Uso: npm run build:apk
//
// Requisitos: Android SDK (Android Studio) com a plataforma 35 e um JDK 21.
// O script procura o SDK em ANDROID_HOME / %LOCALAPPDATA%\Android\Sdk e o JDK em
// JAVA_HOME (se for 17–21) ou nos locais comuns do Windows.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = path.join(ROOT, 'apps', 'mobile');
const ANDROID = path.join(MOBILE, 'android');
const isWin = process.platform === 'win32';
const step = (msg) => console.log(`\n▶ ${msg}`);
const run = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, ...opts });
  if (res.status !== 0) {
    console.error(`\n✖ Falhou: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
};

function javaMajor(home) {
  const bin = path.join(home, 'bin', isWin ? 'java.exe' : 'java');
  if (!fs.existsSync(bin)) return 0;
  // "java -version" escreve no stderr.
  const res = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  return Number(/version "(\d+)/.exec(`${res.stderr}${res.stdout}`)?.[1]) || 0;
}

function findJdk() {
  const candidates = [process.env.JAVA_HOME];
  if (isWin) {
    for (const base of ['C:/Program Files/OpenLogic', 'C:/Program Files/Java', 'C:/Program Files/Eclipse Adoptium', 'C:/Program Files/Microsoft']) {
      if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) candidates.push(path.join(base, d));
    }
    candidates.push('C:/Program Files/Android/Android Studio/jbr');
  }
  // O Gradle do Capacitor 7 roda com JDK 17–21 (21 recomendado).
  const ok = candidates.filter(Boolean).map((h) => ({ h, v: javaMajor(h) })).filter((j) => j.v >= 17 && j.v <= 21);
  ok.sort((a, b) => b.v - a.v);
  return ok[0]?.h;
}

function findSdk() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  if (isWin && process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
  if (process.env.HOME) candidates.push(path.join(process.env.HOME, 'Android', 'Sdk'), path.join(process.env.HOME, 'Library/Android/sdk'));
  return candidates.filter(Boolean).find((p) => fs.existsSync(path.join(p, 'platforms')));
}

const jdk = findJdk();
const sdk = findSdk();
if (!jdk) {
  console.error('✖ Nenhum JDK 17–21 encontrado. Instale o JDK 21 ou defina JAVA_HOME.');
  process.exit(1);
}
if (!sdk) {
  console.error('✖ Android SDK não encontrado. Instale o Android Studio ou defina ANDROID_HOME.');
  process.exit(1);
}
console.log(`JDK: ${jdk}\nAndroid SDK: ${sdk}`);

step('Compilando o app (Vite)');
run('npm', ['run', 'build', '-w', '@ucop/mobile'], { cwd: ROOT });

step('Preparando o projeto Android (Capacitor)');
if (!fs.existsSync(ANDROID)) run('npx', ['cap', 'add', 'android'], { cwd: MOBILE });
run('npx', ['cap', 'sync', 'android'], { cwd: MOBILE });
fs.writeFileSync(path.join(ANDROID, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);

// O wrapper baixa a distribuição "all" (~200 MB) com tempo limite de 10 s, o que falha
// em conexões mais lentas: usa a "bin" (menor) e espera até 10 minutos.
const wrapperProps = path.join(ANDROID, 'gradle', 'wrapper', 'gradle-wrapper.properties');
fs.writeFileSync(
  wrapperProps,
  fs
    .readFileSync(wrapperProps, 'utf8')
    .replace(/-all\.zip/, '-bin.zip')
    .replace(/networkTimeout=\d+/, 'networkTimeout=600000'),
);

step('Compilando o APK (Gradle — a primeira vez baixa o Gradle e as dependências)');
const gradlew = path.join(ANDROID, isWin ? 'gradlew.bat' : 'gradlew');
run(isWin ? `"${gradlew}"` : gradlew, ['assembleDebug', '--no-daemon', '-q'], {
  cwd: ANDROID,
  env: { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk },
});

const apk = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!fs.existsSync(apk)) {
  console.error('✖ O Gradle terminou, mas o APK não foi encontrado em ' + apk);
  process.exit(1);
}
fs.mkdirSync(path.join(ROOT, 'release'), { recursive: true });
const out = path.join(ROOT, 'release', 'UCOP.apk');
fs.copyFileSync(apk, out);
console.log(`\n✔ Pronto: ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
console.log('  Copie para o celular e instale (permita "instalar apps de fontes desconhecidas").');
