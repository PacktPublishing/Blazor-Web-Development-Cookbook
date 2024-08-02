namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe03;

public class Event
{
    [EventNameValidation]
    public string Name { get; set; }
}