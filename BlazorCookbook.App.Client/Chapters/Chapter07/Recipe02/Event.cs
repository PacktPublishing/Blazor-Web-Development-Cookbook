using System.ComponentModel.DataAnnotations;

namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe02;

public record Event
{
    [Required(ErrorMessage = "You must provide name.")]
    public string Name { get; set; }
}