namespace BlazorCookbook.App.Client.Chapters.Chapter01.Data;

public static class Samples
{
    public static readonly TicketViewModel
        Adult = new("Adult", 10.00m, 100),
        FreeAdmission = new("Free Admission", 0.00m, 100),
        Elderly = new("Elderly", 8.00m, 10);

    public static readonly TicketViewModel[] Tickets = [
        new("Adult", 10.00m, 100),
        new("Free Admission", 0.00m, 100),
        new("Elderly", 8.00m, 0),
        new("Child", 5.00m, 0),
        new("Student", 5.00m, 0),
        new("Family", 20.00m, 0),
        new("Class", 100.00m, 0)
    ];
}
