using Microsoft.AspNetCore.Components;

namespace BlazorCookbook.App.Client.Chapters.Chapter04.Recipe04;

public class ColumnViewModel<T>
{
    public string Label { get; init; }
    public RenderFragment<T> Template { get; init; }
    public Func<T, object> Property { get; init; }
}
