using System.ComponentModel.DataAnnotations;

namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe02;

public class Event
{
    [Required(ErrorMessage = "You must provide a name.")]
    public string Name { get; set; }
}