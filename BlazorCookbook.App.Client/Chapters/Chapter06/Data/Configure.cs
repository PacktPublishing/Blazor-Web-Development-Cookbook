namespace BlazorCookbook.App.Client.Chapters.Chapter06.Data;

public static class Configure
{
    public static IServiceCollection AddChapter06(this IServiceCollection services)
    {
        //registration of sample data service

        services.AddTransient<Recipe05.FileStorage>();

        return services;
    }
}
