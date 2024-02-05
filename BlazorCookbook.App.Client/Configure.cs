using Recipe03 = BlazorCookbook.App.Client.Chapters.Chapter02.Recipe03.Data;
using Recipe04 = BlazorCookbook.App.Client.Chapters.Chapter02.Recipe04.Data;
using Recipe06 = BlazorCookbook.App.Client.Chapters.Chapter02.Recipe06.Data;

namespace BlazorCookbook.App.Client;

public static class Configure
{
    public static IServiceCollection ConfigureRecipe03(this IServiceCollection services)
    {
        services.AddTransient<Recipe03.SuggestionsApi>();
        return services;
    }

    public static IServiceCollection ConfigureRecipe04(this IServiceCollection services)
    {
        services.AddTransient<Recipe04.SuggestionsApi>();
        return services;
    }

    public static IServiceCollection ConfigureRecipe06(this IServiceCollection services)
    {
        services.AddTransient<Recipe06.SuggestionsApi>();
        return services;
    }
}