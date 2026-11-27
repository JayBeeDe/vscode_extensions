# Unmaximizes an X11 window and gives it a size: python3 xunmax.py <window id> <width> <height>
# (used by screenshots.mjs: some desktops maximize every new window, and xdotool can't unmaximize one)
import ctypes, sys, time
wid, width, height = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
x = ctypes.cdll.LoadLibrary('libX11.so.6')
x.XOpenDisplay.restype = ctypes.c_void_p
x.XInternAtom.restype = ctypes.c_ulong
x.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
x.XDefaultRootWindow.restype = ctypes.c_ulong
x.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
d = x.XOpenDisplay(None)
class ClientMessage(ctypes.Structure):
    _fields_ = [('type', ctypes.c_int), ('serial', ctypes.c_ulong), ('send_event', ctypes.c_int), ('display', ctypes.c_void_p),
                ('window', ctypes.c_ulong), ('message_type', ctypes.c_ulong), ('format', ctypes.c_int), ('data', ctypes.c_long * 5)]
class Event(ctypes.Union):
    _fields_ = [('xclient', ClientMessage), ('pad', ctypes.c_long * 24)]
e = Event()
e.xclient.type = 33  # ClientMessage
e.xclient.send_event = 1
e.xclient.window = wid
e.xclient.message_type = x.XInternAtom(d, b'_NET_WM_STATE', 0)
e.xclient.format = 32
e.xclient.data[0] = 0  # remove
e.xclient.data[1] = x.XInternAtom(d, b'_NET_WM_STATE_MAXIMIZED_VERT', 0)
e.xclient.data[2] = x.XInternAtom(d, b'_NET_WM_STATE_MAXIMIZED_HORZ', 0)
e.xclient.data[3] = 1
x.XSendEvent.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_long, ctypes.POINTER(Event)]
x.XSendEvent(d, x.XDefaultRootWindow(d), 0, (1 << 20) | (1 << 19), ctypes.byref(e))
x.XFlush.argtypes = [ctypes.c_void_p]
x.XFlush(d)
time.sleep(0.5)
x.XResizeWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_uint, ctypes.c_uint]
x.XResizeWindow(d, wid, width, height)
x.XFlush(d)
