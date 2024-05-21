using System.Text.Json;
using System.Text.Json.Serialization;

namespace BlazorCookbook.App.Client.Chapters.Chapter06.Data;

public record Event
{
    public string Name { get; set; }
    public EventPeriod Period { get; set; } = new();

    public bool IsActive { get; set; }
    public string Location { get; set; }
    public int Capacity { get; set; }
    public EventType Type { get; set; }
    public string Description { get; set; }

    [JsonIgnore]
    public string Json => JsonSerializer.Serialize(this);
}
