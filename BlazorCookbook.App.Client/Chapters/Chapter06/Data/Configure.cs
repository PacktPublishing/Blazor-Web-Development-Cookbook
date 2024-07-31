namespace BlazorCookbook.App.Client.Chapters.Chapter06.Data;

public static class Configure
{
    public static IServiceCollection AddChapter06(this IServiceCollection services)
    {
        services.AddTransient<FileStorage>();

        return services;
    }
}
