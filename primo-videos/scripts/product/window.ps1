# Ajudante do Windows para gravar a janela de um programa (o par do window.swift). Chamado pelo record-window.mjs:
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File window.ps1 <operacao> [args]
#   permissao             -> {"tela":true,"acessibilidade":true}   (o Windows nao tem essas permissoes)
#   listar                -> janelas visiveis, da frente para tras: [{id,pid,dono,titulo,x,y,w,h,camada,escala}]
#   tela                  -> a area de trabalho de todos os monitores: {x,y,w,h}
#   processos             -> [[pid,ppid],...]
#   frente <id>           -> traz a janela para a frente: {"ok":bool}
#   clicar <x> <y> [<id>] -> clica no ponto so se a janela de cima ali e a <id>: {"ok":bool,"topo":{...}}
#   servir                -> uma operacao por linha na entrada, uma linha de JSON por resposta (compila o C# uma vez so)
# Tudo em pixels reais da tela: cada operacao deixa a thread ciente da escala (DPI) por monitor antes de medir ou clicar.
# O JSON sai so em ASCII (o resto vira \uXXXX): nao depende da pagina de codigo do console.
# Este arquivo fica sem acento: o PowerShell 5.1 le .ps1 sem BOM como ANSI.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$cs = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class JanelaWin
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    public delegate bool EnumProc(IntPtr h, IntPtr l);
    public delegate bool MonitorProc(IntPtr m, IntPtr dc, ref RECT r, IntPtr l);

    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr dc, IntPtr clip, MonitorProc f, IntPtr l);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", EntryPoint = "GetWindowTextW", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", EntryPoint = "GetWindowTextLengthW", CharSet = CharSet.Unicode)] static extern int GetWindowTextLength(IntPtr h);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("dwmapi.dll", EntryPoint = "DwmGetWindowAttribute")] static extern int DwmRect(IntPtr h, int a, out RECT r, int n);
    [DllImport("dwmapi.dll", EntryPoint = "DwmGetWindowAttribute")] static extern int DwmInt(IntPtr h, int a, out int v, int n);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
    [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr m, int t, out uint x, out uint y);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr depois, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint de, uint para, bool unir);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint f);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, uint d, UIntPtr extra);

    static readonly CultureInfo C = CultureInfo.InvariantCulture;

    // por monitor v2, senao v1; no Windows antigo, ciente da escala do sistema
    static void Dpi()
    {
        try
        {
            if (SetThreadDpiAwarenessContext(new IntPtr(-4)) != IntPtr.Zero) return;
            if (SetThreadDpiAwarenessContext(new IntPtr(-3)) != IntPtr.Zero) return;
        }
        catch (EntryPointNotFoundException) { }
        try { SetProcessDPIAware(); } catch (EntryPointNotFoundException) { }
    }

    public static string Str(string s)
    {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        foreach (char ch in s)
        {
            if (ch == '"') b.Append("\\\"");
            else if (ch == '\\') b.Append("\\\\");
            else if (ch < ' ' || ch > '~') b.Append("\\u").Append(((int)ch).ToString("x4", C));
            else b.Append(ch);
        }
        return b.Append('"').ToString();
    }

    static string Num(long v) { return v.ToString(C); }

    static string Nome(Dictionary<uint, string> cache, uint pid)
    {
        string n;
        if (cache.TryGetValue(pid, out n)) return n;
        try { n = Process.GetProcessById((int)pid).ProcessName; } catch (Exception) { n = ""; }
        cache[pid] = n;
        return n;
    }

    static string Titulo(IntPtr h)
    {
        int n = GetWindowTextLength(h);
        if (n <= 0) return "";
        StringBuilder s = new StringBuilder(n + 1);
        GetWindowText(h, s, n + 1);
        return s.ToString();
    }

    // o retangulo que aparece na tela, sem a borda invisivel nem a sombra (DWMWA_EXTENDED_FRAME_BOUNDS = 9)
    static RECT Retangulo(IntPtr h)
    {
        RECT r;
        if (DwmRect(h, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) GetWindowRect(h, out r);
        return r;
    }

    static double Escala(IntPtr h)
    {
        try
        {
            uint dx, dy;
            IntPtr m = MonitorFromWindow(h, 2);
            if (m != IntPtr.Zero && GetDpiForMonitor(m, 0, out dx, out dy) == 0 && dx > 0) return dx / 96.0;
        }
        catch (DllNotFoundException) { }
        catch (EntryPointNotFoundException) { }
        return 1.0;
    }

    static string Item(IntPtr h, Dictionary<uint, string> nomes)
    {
        uint pid;
        GetWindowThreadProcessId(h, out pid);
        RECT r = Retangulo(h);
        // camada 0 = janela comum; 1 = janela de ferramenta (WS_EX_TOOLWINDOW), que nunca e a principal
        int camada = (GetWindowLong(h, -20) & 0x80) != 0 ? 1 : 0;
        return "{\"id\":" + Num(h.ToInt64()) + ",\"pid\":" + Num(pid) + ",\"dono\":" + Str(Nome(nomes, pid)) + ",\"titulo\":" + Str(Titulo(h))
            + ",\"x\":" + Num(r.Left) + ",\"y\":" + Num(r.Top) + ",\"w\":" + Num(r.Right - r.Left) + ",\"h\":" + Num(r.Bottom - r.Top)
            + ",\"camada\":" + Num(camada) + ",\"escala\":" + Escala(h).ToString("0.###", C) + "}";
    }

    // EnumWindows vem na ordem da pilha: a de cima primeiro
    public static string Listar()
    {
        Dpi();
        Dictionary<uint, string> nomes = new Dictionary<uint, string>();
        List<string> itens = new List<string>();
        EnumWindows(delegate (IntPtr h, IntPtr l)
        {
            if (!IsWindowVisible(h) || IsIconic(h)) return true;
            int escondida;
            if (DwmInt(h, 14, out escondida, 4) == 0 && escondida != 0) return true;
            RECT r = Retangulo(h);
            if (r.Right - r.Left <= 0 || r.Bottom - r.Top <= 0) return true;
            itens.Add(Item(h, nomes));
            return true;
        }, IntPtr.Zero);
        return "[" + string.Join(",", itens) + "]";
    }

    public static string Tela()
    {
        Dpi();
        int x0 = int.MaxValue, y0 = int.MaxValue, x1 = int.MinValue, y1 = int.MinValue;
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, delegate (IntPtr m, IntPtr dc, ref RECT r, IntPtr l)
        {
            x0 = Math.Min(x0, r.Left); y0 = Math.Min(y0, r.Top);
            x1 = Math.Max(x1, r.Right); y1 = Math.Max(y1, r.Bottom);
            return true;
        }, IntPtr.Zero);
        if (x0 == int.MaxValue) { x0 = 0; y0 = 0; x1 = GetSystemMetrics(0); y1 = GetSystemMetrics(1); }
        return "{\"x\":" + Num(x0) + ",\"y\":" + Num(y0) + ",\"w\":" + Num(x1 - x0) + ",\"h\":" + Num(y1 - y0) + "}";
    }

    // so a ordem na pilha e o foco mudam: posicao e tamanho ficam como estao
    public static string Frente(long id)
    {
        Dpi();
        IntPtr h = new IntPtr(id);
        if (!IsWindow(h)) return "{\"ok\":false}";
        if (IsIconic(h)) ShowWindow(h, 9);
        if ((GetWindowLong(h, -20) & 0x8) == 0)
        {
            // HWND_TOPMOST e de volta HWND_NOTOPMOST: fica em cima das comuns mesmo sem o foco (SWP_NOSIZE|SWP_NOMOVE|SWP_SHOWWINDOW)
            SetWindowPos(h, new IntPtr(-1), 0, 0, 0, 0, 0x43);
            SetWindowPos(h, new IntPtr(-2), 0, 0, 0, 0, 0x43);
        }
        // o Windows so deixa trocar o foco quem tem a entrada: liga a fila de entrada a da janela que esta com o foco
        IntPtr fg = GetForegroundWindow();
        uint outro;
        uint deles = fg == IntPtr.Zero ? 0u : GetWindowThreadProcessId(fg, out outro);
        uint meu = GetCurrentThreadId();
        bool unido = deles != 0 && deles != meu && AttachThreadInput(meu, deles, true);
        BringWindowToTop(h);
        SetForegroundWindow(h);
        if (unido) AttachThreadInput(meu, deles, false);
        return "{\"ok\":" + (GetForegroundWindow() == h ? "true" : "false") + "}";
    }

    // o clique mexe no mouse de verdade: so sai se a janela que recebe o clique naquele ponto e a pedida
    public static string Clicar(int x, int y, long id)
    {
        Dpi();
        if (id != 0)
        {
            POINT p;
            p.X = x;
            p.Y = y;
            IntPtr alvo = WindowFromPoint(p);
            IntPtr raiz = alvo == IntPtr.Zero ? IntPtr.Zero : GetAncestor(alvo, 2);
            if (raiz != new IntPtr(id))
            {
                if (raiz == IntPtr.Zero) return "{\"ok\":false,\"topo\":null}";
                return "{\"ok\":false,\"topo\":" + Item(raiz, new Dictionary<uint, string>()) + "}";
            }
        }
        SetCursorPos(x, y);
        Thread.Sleep(60);
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(60);
        mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        return "{\"ok\":true}";
    }
}
'@
Add-Type -TypeDefinition $cs -Language CSharp

function Responde([string[]] $p) {
  try {
    switch ($p[0]) {
      'permissao' { return '{"tela":true,"acessibilidade":true}' }
      'listar' { return [JanelaWin]::Listar() }
      'tela' { return [JanelaWin]::Tela() }
      'processos' {
        $lista = Get-CimInstance -Query 'SELECT ProcessId, ParentProcessId FROM Win32_Process'
        return '[' + (($lista | ForEach-Object { '[' + $_.ProcessId + ',' + $_.ParentProcessId + ']' }) -join ',') + ']'
      }
      'frente' { return [JanelaWin]::Frente([long]$p[1]) }
      'clicar' {
        $id = 0
        if ($p.Count -gt 3) { $id = [long]$p[3] }
        return [JanelaWin]::Clicar([int]$p[1], [int]$p[2], $id)
      }
      default { return '{"erro":' + [JanelaWin]::Str('unknown operation: ' + $p[0]) + '}' }
    }
  } catch {
    return '{"erro":' + [JanelaWin]::Str($_.Exception.Message) + '}'
  }
}

$op = ''
if ($args.Count -gt 0) { $op = [string]$args[0] }
if ($op -eq 'servir') {
  while ($true) {
    $linha = [Console]::In.ReadLine()
    if ($null -eq $linha) { break }
    $p = @($linha.Trim() -split '\s+')
    if ($p[0] -eq '') { continue }
    [Console]::Out.WriteLine([string](Responde $p))
    [Console]::Out.Flush()
  }
  exit 0
}
if ($op -eq '') {
  [Console]::Error.WriteLine('usage: window.ps1 permissao|listar|tela|processos|frente <id>|clicar <x> <y> [<id>]|servir')
  exit 1
}
$r = [string](Responde ([string[]]$args))
[Console]::Out.WriteLine($r)
if ($r.StartsWith('{"erro"')) { exit 1 }
exit 0
