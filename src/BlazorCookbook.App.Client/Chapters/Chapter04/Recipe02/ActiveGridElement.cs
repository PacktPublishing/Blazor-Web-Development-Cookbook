using Microsoft.AspNetCore.Components;

namespace BlazorCookbook.App.Client.Chapters.Chapter04.Recipe02;

public abstract class ActiveGridElement : ComponentBase
{
    [EditorRequired, Parameter]
    public RenderFragment ChildContent { get; set; } = default!;

    [Parameter]
    public EventCallback OnClick { get; set; }
}