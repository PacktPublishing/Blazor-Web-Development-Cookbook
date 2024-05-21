using System.ComponentModel.DataAnnotations;

namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe04;

public record Event
{
    [EventNameValidation]
    public string Name { get; set; }

    [ValidateComplexType]
    public EventLocation Location { get; set; } = new();
}