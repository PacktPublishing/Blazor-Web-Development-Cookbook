namespace BlazorCookbook.App.Client.Chapters.Chapter03.Data;

internal static class Tickets
{
    public static Ticket[] All = [
        new("Adult", 20.00m),
        new("Child", 10.00m),
        new("Infant", 5.00m),
        new("Veteran", 5.00m),
        new("Elderly", 5.00m),
        new("Guardian", 0.00m),
        new("Disabled", 5.00m),
        new("Student", 10.00m),
        new("Honorary", 0.00m)
    ];
}
