﻿using System.ComponentModel.DataAnnotations;

namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe05;

public class EventLocation
{
    [Required(ErrorMessage = "You must provide a venue.")]
    public string Venue { get; set; }

    [Required, Range(1, 1000, 
        ErrorMessage = "Capacity must be between 1 and 1000.")]
    public int Capacity { get; set; }
}
