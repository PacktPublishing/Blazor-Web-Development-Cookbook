namespace BlazorCookbook.App.Client.Chapters.Chapter02.Recipe05.Data;

public static class DataSeed
{
    public static readonly IList<SkillLevel> SkillLevels = [
        new(1, "Basic"),
        new(2, "Intermediate"),
        new(3, "Advanced"),
        new(4, "Expert")
    ];
}
