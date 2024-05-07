﻿using System.ComponentModel.DataAnnotations;

namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe05;

public record EventLocation
{
    [Required(ErrorMessage = "You must provide venue.")]
    public string Venue { get; set; }

    [Required, Range(1, 1000, 
        ErrorMessage = "Capacity must be in 1-1000.")]
    public int Capacity { get; set; }
}