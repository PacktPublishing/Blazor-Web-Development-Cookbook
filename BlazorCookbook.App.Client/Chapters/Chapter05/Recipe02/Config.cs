using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components;

namespace BlazorCookbook.App.Client.Chapters.Chapter05.Recipe02;

internal static class Config
{
    public static readonly IComponentRenderMode PrerenderDisabled
        = new InteractiveWebAssemblyRenderMode(prerender: false);
}
