using Microsoft.AspNetCore.Components;

namespace BlazorCookbook.App.Client.Chapters.Chapter03.Recipe06;

[EventHandler("onpreventcopy", typeof(PreventedCopyEventArgs))]
public static class EventHandlers { }

public class PreventedCopyEventArgs : EventArgs
{
    public DateTime TimestampUtc { get; init; }
}