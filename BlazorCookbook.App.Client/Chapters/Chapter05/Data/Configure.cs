namespace BlazorCookbook.App.Client.Chapters.Chapter05.Data;

public static class Configure
{
    public static IServiceCollection AddChapter05(this IServiceCollection services)
    {
        services.AddScoped<Data.Api>();

        services.AddScoped<Recipe02.StateContainer<Event>>();

        services.AddScoped<Recipe03.StoreState>();

        services.AddScoped<Recipe04.OverlayState>();

        services.AddScoped<Recipe05.BrowserStorage>();

        services.AddScoped<Recipe06.BrowserStorage>();

        services.AddScoped<Recipe07.BrowserStorage>();
        services.AddCascadingValue(it => new Recipe07.CartState());

        return services;
    }
}
