using Microsoft.AspNetCore.Http;

namespace BlazorCookbook.App.Client.Chapters.Chapter06.Recipe05.TheresMore;

public record EventCover
{
    public IFormFile File { get; set; }
}
