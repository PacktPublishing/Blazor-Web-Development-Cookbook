using System.Text.Json;
using System.Text.Json.Serialization;

namespace BlazorCookbook.App.Client.Chapters.Chapter07.Data;

public record Event
{
    public string Name { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public int Capacity { get; set; }

    public IList<Location> Locations { get; set; }

    [JsonIgnore]
    public string Json => JsonSerializer.Serialize(this);
}
