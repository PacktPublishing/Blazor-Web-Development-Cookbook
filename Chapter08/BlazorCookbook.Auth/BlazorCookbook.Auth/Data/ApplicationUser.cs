using Microsoft.AspNetCore.Identity;

namespace BlazorCookbook.Auth.Data
{
    public class ApplicationUser : IdentityUser
    {
        public string FirstName { get; set; }
        public string LastName { get; set; }
    }
}
