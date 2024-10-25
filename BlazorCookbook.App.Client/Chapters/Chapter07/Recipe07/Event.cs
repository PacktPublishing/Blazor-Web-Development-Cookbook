﻿using System.ComponentModel.DataAnnotations;

namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe07;

public class Event
{
    [EventNameValidation]
    public string Name { get; set; }

    [ValidateComplexType]
    public EventLocation Location { get; set; } = new();
}