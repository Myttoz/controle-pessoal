import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import { descarregarCachePendente, registrarIpc } from './ipc';

// Nome exibido na barra de tarefas, notificações e instalador.
// (O título da janela em si vem do <title> do HTML.)
app.setName('Controle Pessoal');
// Agrupa a janela corretamente na barra de tarefas do Windows.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.controlepessoal.app');
}

/**
 * Ícone do app na barra de tarefas.
 * - Em desenvolvimento: <projeto>/build/icon.png
 * - Empacotado: resources/icon.png (copiado pelo electron-builder)
 */
function caminhoIcone(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../build/icon.png');
}

// Em sessões sem GPU/VM o Chromium pode encerrar o app
// ("GPU process isn't usable"). O app não usa aceleração — software basta.
// Reative com ELECTRON_ENABLE_GPU=1 se desejar.
if (process.env.ELECTRON_ENABLE_GPU !== '1') {
  app.commandLine.appendSwitch('disable-gpu');
  // Mantém a renderização no processo principal: evita a falha de spawn
  // do processo GPU (comum em máquinas/VMs sem GPU dedicada).
  app.commandLine.appendSwitch('in-process-gpu');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

let janela: BrowserWindow | null = null;

/**
 * Controles da janela sem moldura (a barra do topo é desenhada pelo React).
 * O renderer chama estes canais pelos botões de minimizar/maximizar/fechar.
 */
function registrarControlesJanela(): void {
  ipcMain.handle('janela:minimizar', () => {
    janela?.minimize();
  });

  ipcMain.handle('janela:maximizar', () => {
    if (!janela) return false;
    if (janela.isMaximized()) {
      janela.unmaximize();
    } else {
      janela.maximize();
    }
    return janela.isMaximized();
  });

  ipcMain.handle('janela:fechar', () => {
    janela?.close();
  });

  ipcMain.handle('janela:estado', () => janela?.isMaximized() ?? false);
}

function criarJanela(): void {
  janela = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1024,
    minHeight: 660,
    show: false,
    // Sem moldura nativa: a barra superior é desenhada no renderer, no azul do app.
    frame: false,
    backgroundColor: '#020617',
    title: 'Controle Pessoal',
    icon: caminhoIcone(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  janela.once('ready-to-show', () => janela?.show());

  // Avisa o renderer quando a janela é maximizada/restaurada (inclusive por
  // duplo clique na barra ou snap do Windows), para trocar o ícone do botão.
  janela.on('maximize', () => janela?.webContents.send('janela:maximizada', true));
  janela.on('unmaximize', () => janela?.webContents.send('janela:maximizada', false));

  // Diagnóstico opcional: DEBUG_RENDERER=1 npm run dev → espelha o console do renderer
  if (process.env.DEBUG_RENDERER) {
    janela.webContents.on('console-message', (_evento, nivel, mensagem, linha, origem) => {
      console.log(`[renderer:${nivel}] ${mensagem} (${origem}:${linha})`);
    });
    janela.webContents.on('did-fail-load', (_evento, codigo, descricao) => {
      console.error(`[renderer] falha ao carregar: ${codigo} — ${descricao}`);
    });
  }

  // links externos abrem no navegador do sistema
  janela.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const urlDev = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;
  if (urlDev) {
    void janela.loadURL(urlDev);
  } else {
    void janela.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  janela.on('closed', () => {
    janela = null;
  });
}

app.whenReady().then(() => {
  // Remove o menu padrão (File/Edit/View/Window/Help) — era a faixa cinza
  // que destoava do app. A barra do topo agora é a nossa, azul.
  Menu.setApplicationMenu(null);

  registrarControlesJanela();
  registrarIpc();
  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('before-quit', () => {
  descarregarCachePendente();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
