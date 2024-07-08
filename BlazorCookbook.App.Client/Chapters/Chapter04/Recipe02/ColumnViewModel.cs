using Microsoft.AspNetCore.Components;

namespace BlazorCookbook.App.Client.Chapters.Chapter04.Recipe02;

public class ColumnViewModel<T>
{
    public string Label { get; init; }
    public RenderFragment<T> Template { get; init; }
    public EventCallback OnSort { get; init; }
}
