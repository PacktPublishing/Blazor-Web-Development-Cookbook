using BlazorCookbook.App.Client.Chapters.Chapter02;
using BlazorCookbook.App.Client.Chapters.Chapter03.Data;
using BlazorCookbook.App.Client.Chapters.Chapter04.Data;
using BlazorCookbook.App.Client.Chapters.Chapter05.Data;
using BlazorCookbook.App.Client.Chapters.Chapter06.Data;

namespace BlazorCookbook.App.Client;

public static class Configure
{
    public static IServiceCollection AddChapters(this IServiceCollection services)
    {
        services.AddChapter02()
                .AddChapter03()
                .AddChapter04()
                .AddChapter05()
                .AddChapter06();

        return services;
    }
}
