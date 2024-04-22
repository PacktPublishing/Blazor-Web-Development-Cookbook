using BlazorCookbook.App.Client.Chapters.Chapter05.Recipe02;
using BlazorCookbook.App.Client.Chapters.Chapter05.Recipe03;
using BlazorCookbook.App.Client.Chapters.Chapter05.Recipe04;
using BlazorCookbook.App.Client.Chapters.Chapter05.Recipe07;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BlazorCookbook.App.Client.Chapters.Chapter05.Data;

public static class Config
{
    public static readonly IComponentRenderMode PrerenderDisabled
        = new InteractiveWebAssemblyRenderMode(prerender: false);

    public static IServiceCollection AddChapter05(this IServiceCollection services)
    {
        services.AddRecipe01()
                .AddRecipe02()
                .AddRecipe03()
                .AddRecipe04()
                .AddRecipe05()
                .AddRecipe06()
                .AddRecipe07();

        return services;
    }
    
    public static IServiceCollection AddRecipe01(this IServiceCollection services)
    {
        services.TryAddSingleton<Api>();
        return services;
    }

    public static IServiceCollection AddRecipe02(this IServiceCollection services)
    {
        services.TryAddSingleton<Api>();
        services.TryAddScoped<StateContainer<Event>>();
        return services;
    }

    public static IServiceCollection AddRecipe03(this IServiceCollection services)
    {
        services.TryAddSingleton<Api>();
        services.TryAddScoped<StoreState>();
        return services;
    }

    public static IServiceCollection AddRecipe04(this IServiceCollection services)
    {
        services.TryAddSingleton<Api>();
        services.TryAddScoped<OverlayState>();
        return services;
    }

    public static IServiceCollection AddRecipe05(this IServiceCollection services)
    {
        services.TryAddSingleton<Api>();
        services.TryAddScoped<Recipe05.BrowserStorage>();
        return services;
    }

    public static IServiceCollection AddRecipe06(this IServiceCollection services)
    {
        services.TryAddSingleton<Api>();
        services.TryAddScoped<Recipe06.BrowserStorage>();
        return services;
    }

    public static IServiceCollection AddRecipe07(this IServiceCollection services)
    {
        services.TryAddSingleton<Api>();
        services.TryAddScoped<Recipe07.BrowserStorage>();
        services.AddCascadingValue(it => CartState.Empty);
        return services;
    }
}
