"""Win32 por ctypes para o organizar.py e o terminal-claude: monitores, janelas do Windows Terminal,
processos e sono do sistema. Só é importado no Windows.

As coordenadas são as do Windows: origem no canto superior esquerdo do monitor principal, y para
baixo. O Python não se declara ciente de DPI, então o Windows entrega tudo na escala lógica (96 dpi),
nos monitores e nas janelas, e os mínimos da grade valem como no Mac.
"""
import ctypes
from ctypes import wintypes

user32 = ctypes.WinDLL("user32")
kernel32 = ctypes.WinDLL("kernel32")
CLASSE = "CASCADIA_HOSTING_WINDOW_CLASS"  # a janela do Windows Terminal


class MONITORINFO(ctypes.Structure):
    _fields_ = [("cbSize", wintypes.DWORD), ("rcMonitor", wintypes.RECT),
                ("rcWork", wintypes.RECT), ("dwFlags", wintypes.DWORD)]


ENUM_MONITOR = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMONITOR, wintypes.HDC,
                                  ctypes.POINTER(wintypes.RECT), wintypes.LPARAM)
ENUM_JANELA = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

# Sem declarar os tipos o ctypes passa handle como int de 32 bits e corta o ponteiro no Windows de 64.
user32.EnumDisplayMonitors.argtypes = [wintypes.HDC, ctypes.POINTER(wintypes.RECT), ENUM_MONITOR, wintypes.LPARAM]
user32.GetMonitorInfoW.argtypes = [wintypes.HMONITOR, ctypes.POINTER(MONITORINFO)]
user32.EnumWindows.argtypes = [ENUM_JANELA, wintypes.LPARAM]
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
for _f in (user32.IsWindow, user32.IsWindowVisible, user32.IsIconic, user32.IsZoomed, user32.SetForegroundWindow):
    _f.argtypes = [wintypes.HWND]
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
                                ctypes.c_int, ctypes.c_int, wintypes.UINT]
user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
kernel32.SetThreadExecutionState.argtypes = [wintypes.DWORD]


def monitores():
    """(principal, esquerda, topo, largura, altura) da área útil de cada monitor, sem a barra de tarefas."""
    achados = []

    def cada(hmon, _hdc, _rect, _dado):
        info = MONITORINFO()
        info.cbSize = ctypes.sizeof(MONITORINFO)
        user32.GetMonitorInfoW(hmon, ctypes.byref(info))
        w = info.rcWork
        achados.append((bool(info.dwFlags & 1), w.left, w.top, w.right - w.left, w.bottom - w.top))
        return True

    user32.EnumDisplayMonitors(None, None, ENUM_MONITOR(cada), 0)
    return achados


def classe(hwnd):
    nome = ctypes.create_unicode_buffer(64)
    user32.GetClassNameW(hwnd, nome, 64)
    return nome.value


def janelas():
    """(hwnd, esquerda, topo, direita, base) de cada janela do Windows Terminal visível e não minimizada."""
    achadas = []

    def cada(hwnd, _dado):
        if classe(hwnd) == CLASSE and user32.IsWindowVisible(hwnd) and not user32.IsIconic(hwnd):
            r = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(r))
            achadas.append((hwnd, r.left, r.top, r.right, r.bottom))
        return True

    user32.EnumWindows(ENUM_JANELA(cada), 0)
    return achadas


def existe(hwnd):
    # O Windows reaproveita o número de uma janela fechada: confere que ainda é do Windows Terminal.
    return bool(user32.IsWindow(hwnd)) and classe(hwnd) == CLASSE


def mover(hwnd, esquerda, topo, direita, base, trazer=False):
    if user32.IsZoomed(hwnd):
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE: maximizada ignora o tamanho pedido
    # 0x0010 = não ativar; 0x0004 = não mexer na ordem das janelas (sem ele, vem pra frente)
    user32.SetWindowPos(hwnd, None, esquerda, topo, direita - esquerda, base - topo,
                        0x0010 | (0 if trazer else 0x0004))


def trazer_para_frente(hwnd):
    user32.SetForegroundWindow(hwnd)


def pedir_para_fechar(hwnd):
    user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE


def processo_vivo(pid):
    h = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return False
    codigo = wintypes.DWORD()
    kernel32.GetExitCodeProcess(h, ctypes.byref(codigo))
    kernel32.CloseHandle(h)
    return codigo.value == 259  # STILL_ACTIVE


def manter_acordado(ligado=True):
    """Segura o sono do sistema enquanto a thread viver (a tela ainda apaga), como o caffeinate -ims."""
    kernel32.SetThreadExecutionState(0x80000000 | (0x00000001 if ligado else 0))
