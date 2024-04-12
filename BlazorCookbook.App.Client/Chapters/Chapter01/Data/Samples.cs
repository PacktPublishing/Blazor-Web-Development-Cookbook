namespace BlazorCookbook.App.Client.Chapters.Chapter01.Data;

public static class Samples
{
    public static readonly TicketViewModel
        Adult = new("Adult", 10.00m),
        FreeAdmission = new("Free Admission", 0.00m),
        Elderly = new("Elderly", 8.00m);

    public static readonly TicketViewModel[] Tickets = [
        new("Adult", 10.00m),
        new("Free Admission", 0.00m),
        new("Elderly", 8.00m),
        new("Child", 5.00m),
        new("Student", 5.00m),
        new("Family", 20.00m),
        new("Class", 100.00m)
    ];
}
