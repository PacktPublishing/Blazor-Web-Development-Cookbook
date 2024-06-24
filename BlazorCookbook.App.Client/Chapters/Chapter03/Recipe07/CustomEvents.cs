﻿using Microsoft.AspNetCore.Components;

namespace BlazorCookbook.App.Client.Chapters.Chapter03.Recipe07;

[EventHandler("onpreventcopy", typeof(PreventedCopyEventArgs))]
public static class EventHandlers { }

public class PreventedCopyEventArgs : EventArgs
{
    public DateTime Stamp { get; init; }
}