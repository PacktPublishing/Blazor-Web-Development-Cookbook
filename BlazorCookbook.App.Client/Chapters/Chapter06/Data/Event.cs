namespace BlazorCookbook.App.Client.Chapters.Chapter06.Data;

public record Event
{
    public Guid Id { get; init; }
    public string Name { get; set; }
    public EventPeriod Period { get; set; } = new();
}
