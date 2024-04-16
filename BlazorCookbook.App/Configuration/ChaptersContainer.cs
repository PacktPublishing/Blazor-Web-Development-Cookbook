namespace BlazorCookbook.App.Configuration;

internal static class ChaptersContainer
{
    private static readonly Dictionary<int, int> _chapters = new()
    {
        { 1, 7 },
        { 2, 6 },
        { 3, 7 },
        { 4, 7 },
        { 5, 7 },
        { 6, 5 },
        { 7, 0 },
        { 8, 0 },
        { 9, 0 },
        { 10, 0 }
    };

    public static int HowManyChapters => _chapters.Count;

    public static int HowManyRecipes(int number) => _chapters[number];
}