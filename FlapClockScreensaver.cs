// FlapClock.scr - a genuine Windows screensaver that renders the local flip clock.
// Written by Deacon Sholy.
// Built with the C# compiler that ships with Windows + the WebView2 SDK.
//   csc /target:winexe /platform:x64 /out:FlapClock.scr /r:... FlapClockScreensaver.cs
// Targets C# 5 (no interpolation / expression-bodied members / null-conditional).

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("FlapClock")]
[assembly: AssemblyProduct("FlapClock")]
[assembly: AssemblyCompany("Deacon Sholy")]
[assembly: AssemblyDescription("FlapClock - a split-flap flip clock screensaver for Windows. Written by Deacon Sholy.")]
[assembly: AssemblyCopyright("Copyright (c) 2026 Deacon Sholy")]
[assembly: AssemblyTrademark("")]
[assembly: AssemblyCulture("")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]
[assembly: AssemblyInformationalVersion("1.0.0")]

internal static class FlapClockScreensaver
{
    // ---- input hooks (WebView2 swallows key/mouse events, so we hook globally) ----
    private const int WH_MOUSE_LL = 14;
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_MOUSEMOVE = 0x0200;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;

    // Ignore mouse motion for this long after activation, and require real travel.
    // Otherwise residual pointer jitter at the moment of activation kills it instantly.
    private const int GRACE_MS = 1500;
    private const int MOVE_TOLERANCE = 6;

    private delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);

    private static IntPtr mouseHook = IntPtr.Zero;
    private static IntPtr keyHook = IntPtr.Zero;
    private static int startX = int.MinValue;
    private static int startY = int.MinValue;
    private static Stopwatch clock;
    private static string pagePath;
    private static bool exiting;

    private static void Log(string m)
    {
#if DEBUG
        try
        {
            File.AppendAllText(Path.Combine(Path.GetTempPath(), "flapclock-scr.log"),
                DateTime.Now.ToString("HH:mm:ss.fff") + "  " + m + Environment.NewLine);
        }
        catch (Exception) { }
#endif
    }

    [STAThread]
    private static void Main(string[] args)
    {
        clock = Stopwatch.StartNew();
        try { SetProcessDPIAware(); } catch (Exception) { }

        bool run = false;
        bool noDismiss = false;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "-s" || args[i] == "/s") run = true;
            if (args[i] == "-nodismiss") noDismiss = true;
        }
        // "-p" (preview) and no-args (configure) intentionally do nothing.
        if (!run) { Log("not run mode; exiting"); return; }

        Log("run mode, pid=" + Process.GetCurrentProcess().Id);
        pagePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "index.html");
        if (!File.Exists(pagePath)) { Log("index.html missing at " + pagePath); return; }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        Rectangle vs = SystemInformation.VirtualScreen;

        Form screen = new Form();
        screen.FormBorderStyle = FormBorderStyle.None;
        screen.StartPosition = FormStartPosition.Manual;
        screen.Location = vs.Location;
        screen.Size = vs.Size;
        screen.ShowInTaskbar = false;
        screen.TopMost = true;
        screen.BackColor = Color.Black;
        screen.MinimizeBox = false;
        screen.MaximizeBox = false;
        screen.FormClosed += delegate { BeginExit("form closed"); };
        screen.Shown += delegate
        {
            Cursor.Hide();
            Log("shown, bounds=" + screen.Bounds);
        };

        WebView2 view = new WebView2();
        view.Dock = DockStyle.Fill;
        view.DefaultBackgroundColor = Color.Black;
        screen.Controls.Add(view);

        if (!noDismiss) InstallHooks();
        Log("hooks installed: mouse=" + mouseHook + " key=" + keyHook);

        // Only reveal the window once WebView2 is actually up. The message loop
        // runs with no main form, so a failed init exits silently instead of
        // parking a fullscreen black rectangle on the desktop.
        InitWebView(view, delegate
        {
            Log("revealing window");
            screen.Show();
        });

        Log("entering message loop");
        Application.Run();
        Log("message loop ended");
    }

    private static void InitWebView(WebView2 view, Action onReady)
    {
        try
        {
            view.CoreWebView2InitializationCompleted += delegate(object s, CoreWebView2InitializationCompletedEventArgs e)
            {
                bool ok = (e != null && e.IsSuccess);
                string err = (e != null && e.InitializationException != null)
                    ? e.InitializationException.Message : "none";
                Log("WebView2 init ok=" + ok + " err=" + err);
                if (!ok)
                {
                    Log("bailing out: webview init failed");
                    Message(IntPtr.Zero, "FlapClock could not start the browser engine." + Environment.NewLine +
                        Environment.NewLine + err + Environment.NewLine + Environment.NewLine +
                        "Keep these files in the same folder as FlapClock.scr:" + Environment.NewLine +
                        "  Microsoft.Web.WebView2.Core.dll" + Environment.NewLine +
                        "  Microsoft.Web.WebView2.WinForms.dll" + Environment.NewLine +
                        "  WebView2Loader.dll", "FlapClock");
                    Application.ExitThread();
                    return;
                }

                view.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                view.CoreWebView2.Settings.AreDevToolsEnabled = false;
                view.CoreWebView2.Settings.IsStatusBarEnabled = false;
                view.CoreWebView2.Settings.IsZoomControlEnabled = false;
                view.CoreWebView2.Navigate("file:///" + pagePath.Replace('\\', '/'));
                Log("navigated");

                onReady();

#if DEBUG
                view.CoreWebView2.NavigationCompleted += delegate(object s2, CoreWebView2NavigationCompletedEventArgs e2)
                {
                    System.Windows.Forms.Timer probe = new System.Windows.Forms.Timer();
                    probe.Interval = 3000;
                    probe.Tick += delegate
                    {
                        string p =
                            "new Date().toTimeString().slice(0,8) + ' | digits=' + " +
                            "[].map.call(document.querySelectorAll('.card'),function(c){return c.dataset.v;}).join('') + " +
                            "' | cards=' + document.querySelectorAll('.card').length + " +
                            "' | midflip=' + document.querySelectorAll('.card.flipping').length + " +
                            "' | day=' + (document.getElementById('day-line')||{}).textContent";
                        System.Threading.Tasks.Task<string> t = view.CoreWebView2.ExecuteScriptAsync(p);
                        t.ContinueWith(delegate(System.Threading.Tasks.Task<string> tt)
                        {
                            Log("PROBE " + tt.Result);
                        });
                    };
                    probe.Start();
                    Log("probe timer started (3s)");
                };
#endif
            };

            view.EnsureCoreWebView2Async();
            Log("EnsureCoreWebView2Async called");
        }
        catch (Exception ex)
        {
            Log("InitWebView threw: " + ex.Message);
            Application.ExitThread();
        }
    }

    private static void Message(IntPtr hWnd, string text, string caption)
    {
        try { MessageBox(hWnd, text, caption, 0x10); } // MB_ICONERROR
        catch (Exception) { }
    }

    private static void InstallHooks()
    {
        // Low-level hooks live in this process, so a null module handle is the
        // documented way to install them from an exe rather than a DLL.
        mouseHook = SetWindowsHookEx(WH_MOUSE_LL, MouseProc, IntPtr.Zero, 0);
        if (mouseHook == IntPtr.Zero)
            Log("SetWindowsHookEx(mouse) failed, err=" + Marshal.GetLastWin32Error());
        keyHook = SetWindowsHookEx(WH_KEYBOARD_LL, KeyProc, IntPtr.Zero, 0);
        if (keyHook == IntPtr.Zero)
            Log("SetWindowsHookEx(key) failed, err=" + Marshal.GetLastWin32Error());
    }

    private static IntPtr MouseProc(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && (int)wParam == WM_MOUSEMOVE)
        {
            int x = Marshal.ReadInt32(lParam, 0);
            int y = Marshal.ReadInt32(lParam, 4);
            if (clock.ElapsedMilliseconds > GRACE_MS)
            {
                if (startX == int.MinValue)
                {
                    startX = x; startY = y;   // anchor, don't dismiss yet
                }
                else if (Math.Abs(x - startX) > MOVE_TOLERANCE || Math.Abs(y - startY) > MOVE_TOLERANCE)
                {
                    BeginExit("mouse moved");
                }
            }
        }
        return CallNextHookEx(mouseHook, nCode, wParam, lParam);
    }

    private static IntPtr KeyProc(int nCode, IntPtr wParam, IntPtr lParam)
    {
        int msg = (int)wParam;
        if (nCode >= 0 && (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)) BeginExit("key pressed");
        return CallNextHookEx(keyHook, nCode, wParam, lParam);
    }

    private static void BeginExit(string reason)
    {
        if (exiting) return;
        exiting = true;
        Log("BeginExit: " + reason);
        if (mouseHook != IntPtr.Zero) { UnhookWindowsHookEx(mouseHook); mouseHook = IntPtr.Zero; }
        if (keyHook != IntPtr.Zero) { UnhookWindowsHookEx(keyHook); keyHook = IntPtr.Zero; }
        try { Application.Exit(); } catch (Exception) { }
    }
}
