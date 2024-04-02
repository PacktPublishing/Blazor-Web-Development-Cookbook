using BlazorCookbook.App.Client.Chapters.Chapter05.Recipe02;
using BlazorCookbook.App.Client.Chapters.Chapter05.Recipe03;
using BlazorCookbook.App.Client.Chapters.Chapter05.Recipe04;
using BlazorCookbook.App.Client.Chapters.Chapter05.Recipe06;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;

namespace BlazorCookbook.App.Client.Chapters.Chapter05.Data;

public static class Config
{
    public static readonly IComponentRenderMode PrerenderDisabled
        = new InteractiveWebAssemblyRenderMode(prerender: false);

    public static IServiceCollection AddChapter05(this IServiceCollection services)
    {
        //registration of sample data service

        services.AddSingleton<Api>();

        //registration of services built as part of recipes

        services.AddRecipe02()
                .AddRecipe03()
                .AddRecipe04()
                .AddRecipe05()
                .AddRecipe06();

        return services;
    }

    private static IServiceCollection AddRecipe02(this IServiceCollection services)
        => services.AddScoped<StateContainer<Event>>();

    private static IServiceCollection AddRecipe03(this IServiceCollection services)
        => services.AddScoped<StoreState>();

    private static IServiceCollection AddRecipe04(this IServiceCollection services)
        => services.AddScoped<OverlayState>();

    private static IServiceCollection AddRecipe05(this IServiceCollection services)
        => services.AddTransient<Recipe05.BrowserStorage>();

    private static IServiceCollection AddRecipe06(this IServiceCollection services)
        => services.AddTransient<Recipe06.BrowserStorage>();
}
