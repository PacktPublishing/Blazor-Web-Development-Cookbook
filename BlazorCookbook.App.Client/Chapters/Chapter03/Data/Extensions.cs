using Microsoft.AspNetCore.Components.Web;

namespace BlazorCookbook.App.Client.Chapters.Chapter03.Data;

internal static class Extensions
{
    public static bool IsLetter(this KeyboardEventArgs args)
        => args.Key.Length == 1 && char.IsLetter(args.Key[0]);

    public static bool IsBackspace(this KeyboardEventArgs args)
        => args.Key == "Backspace";
}
